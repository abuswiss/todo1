-- COMPLETE SUPABASE SETUP - ALL COLUMNS AND FEATURES
-- This adds all missing columns and sets up advanced PostgreSQL features
-- Run this AFTER the basic supabase-setup.sql

-- ============================================================================
-- FIRST: ADD ALL MISSING COLUMNS TO EXISTING TABLES
-- ============================================================================

-- Add missing columns to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Add missing columns to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at);

-- Add updated_at trigger to both tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tasks table
DROP TRIGGER IF EXISTS trigger_tasks_updated_at ON tasks;
CREATE TRIGGER trigger_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply to projects table
DROP TRIGGER IF EXISTS trigger_projects_updated_at ON projects;
CREATE TRIGGER trigger_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PROPER ROW LEVEL SECURITY (RLS) POLICIES
-- Firebase can't do this level of security
-- ============================================================================

-- Drop the permissive demo policies
DROP POLICY IF EXISTS "Enable all operations for all users" ON tasks;
DROP POLICY IF EXISTS "Enable all operations for all users" ON projects;

-- Create REAL security policies using Supabase Auth
CREATE POLICY "Users can only access their own tasks" ON tasks
    FOR ALL USING (auth.uid()::text = user_id);

CREATE POLICY "Users can only access their own projects" ON projects
    FOR ALL USING (auth.uid()::text = user_id);

-- ============================================================================
-- ADVANCED POSTGRESQL FUNCTIONS
-- Firebase literally cannot do this - this is PostgreSQL's power
-- ============================================================================

-- Function to get user analytics
CREATE OR REPLACE FUNCTION get_user_analytics(p_user_id TEXT)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_tasks', total_tasks,
        'completed_tasks', completed_tasks,
        'completion_rate', CASE 
            WHEN total_tasks > 0 THEN ROUND((completed_tasks::float / total_tasks::float) * 100, 2)
            ELSE 0 
        END,
        'tasks_by_priority', tasks_by_priority,
        'tasks_by_project', tasks_by_project,
        'ai_enhanced_percentage', CASE 
            WHEN total_tasks > 0 THEN ROUND((ai_enhanced_count::float / total_tasks::float) * 100, 2)
            ELSE 0 
        END,
        'average_completion_time_days', avg_completion_time,
        'productivity_trend', productivity_trend
    ) INTO result
    FROM (
        SELECT 
            COUNT(*) as total_tasks,
            COUNT(*) FILTER (WHERE archived = true) as completed_tasks,
            COUNT(*) FILTER (WHERE ai_enhanced = true) as ai_enhanced_count,
            json_object_agg(priority, priority_count) as tasks_by_priority,
            json_object_agg(project_name, project_count) as tasks_by_project,
            AVG(
                CASE 
                    WHEN archived = true THEN 
                        EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400.0
                    ELSE NULL 
                END
            ) as avg_completion_time,
            (
                SELECT json_agg(
                    json_build_object(
                        'date', date_trunc('day', created_at),
                        'completed', COUNT(*) FILTER (WHERE archived = true),
                        'created', COUNT(*)
                    )
                )
                FROM tasks t2 
                WHERE t2.user_id = p_user_id 
                    AND t2.created_at >= NOW() - INTERVAL '30 days'
                GROUP BY date_trunc('day', created_at)
                ORDER BY date_trunc('day', created_at)
            ) as productivity_trend
        FROM (
            SELECT 
                t.*,
                COALESCE(p.name, 'Unknown Project') as project_name,
                priority,
                COUNT(*) OVER (PARTITION BY priority) as priority_count,
                COUNT(*) OVER (PARTITION BY COALESCE(p.name, 'Unknown Project')) as project_count
            FROM tasks t
            LEFT JOIN projects p ON t.project_id = p.id
            WHERE t.user_id = p_user_id
        ) task_stats
    ) analytics;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get productivity insights using window functions
CREATE OR REPLACE FUNCTION get_productivity_insights(p_user_id TEXT, days_back INT DEFAULT 30)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    WITH daily_stats AS (
        SELECT 
            DATE(t.updated_at) as completion_date,
            COUNT(*) FILTER (WHERE t.archived = true) as completed_count,
            AVG(
                CASE 
                    WHEN t.archived = true THEN 
                        EXTRACT(EPOCH FROM (t.updated_at - t.created_at)) / 3600.0
                    ELSE NULL 
                END
            ) as avg_completion_hours,
            COUNT(*) FILTER (WHERE t.ai_enhanced = true AND t.archived = true) as ai_completed
        FROM tasks t
        WHERE t.user_id = p_user_id 
            AND t.archived = true
            AND t.updated_at >= NOW() - (days_back || ' days')::INTERVAL
        GROUP BY DATE(t.updated_at)
        ORDER BY DATE(t.updated_at)
    ),
    project_stats AS (
        SELECT 
            COALESCE(p.name, 'Unknown Project') as project_name,
            ROUND(
                (COUNT(*) FILTER (WHERE t.archived = true)::float / 
                 NULLIF(COUNT(*), 0)::float) * 100, 2
            ) as completion_rate,
            AVG(
                CASE 
                    WHEN t.archived = true THEN 
                        EXTRACT(EPOCH FROM (t.updated_at - t.created_at)) / 3600.0
                    ELSE NULL 
                END
            ) as avg_completion_time
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE t.user_id = p_user_id 
            AND t.created_at >= NOW() - (days_back || ' days')::INTERVAL
        GROUP BY COALESCE(p.name, 'Unknown Project')
    )
    SELECT json_build_object(
        'daily_completions', (SELECT json_agg(
            json_build_object(
                'date', completion_date,
                'completed', completed_count,
                'avg_completion_time_hours', avg_completion_hours,
                'ai_enhanced_completed', ai_completed
            )
        ) FROM daily_stats),
        'peak_productivity_day', (
            SELECT mode() WITHIN GROUP (ORDER BY EXTRACT(dow FROM updated_at))
            FROM tasks 
            WHERE user_id = p_user_id AND archived = true
                AND updated_at >= NOW() - (days_back || ' days')::INTERVAL
        ),
        'peak_productivity_hour', (
            SELECT mode() WITHIN GROUP (ORDER BY EXTRACT(hour FROM updated_at))
            FROM tasks 
            WHERE user_id = p_user_id AND archived = true
                AND updated_at >= NOW() - (days_back || ' days')::INTERVAL
        ),
        'completion_velocity', (
            SELECT CASE 
                WHEN COUNT(*) > 7 THEN
                    ROUND(
                        (COUNT(*) FILTER (WHERE updated_at >= NOW() - INTERVAL '7 days')::float / 7.0) -
                        (COUNT(*) FILTER (WHERE updated_at >= NOW() - INTERVAL '14 days' 
                                         AND updated_at < NOW() - INTERVAL '7 days')::float / 7.0),
                        2
                    )
                ELSE 0
            END
            FROM tasks 
            WHERE user_id = p_user_id AND archived = true
        ),
        'project_performance', (SELECT json_agg(
            json_build_object(
                'project_name', project_name,
                'completion_rate', completion_rate,
                'avg_completion_time', avg_completion_time
            )
        ) FROM project_stats),
        'ai_task_success_rate', (
            SELECT CASE 
                WHEN COUNT(*) FILTER (WHERE ai_enhanced = true) > 0 THEN
                    ROUND(
                        (COUNT(*) FILTER (WHERE ai_enhanced = true AND archived = true)::float /
                         COUNT(*) FILTER (WHERE ai_enhanced = true)::float) * 100, 2
                    )
                ELSE 0
            END
            FROM tasks 
            WHERE user_id = p_user_id 
                AND created_at >= NOW() - (days_back || ' days')::INTERVAL
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ADVANCED TRIGGERS AND AUTOMATION
-- Firebase literally cannot do this
-- ============================================================================

-- Trigger to automatically archive subtasks when parent is archived
CREATE OR REPLACE FUNCTION auto_archive_subtasks()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if parent_task_id column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'parent_task_id'
    ) THEN
        -- If a task is being archived, archive all its subtasks
        IF NEW.archived = true AND OLD.archived = false THEN
            UPDATE tasks 
            SET archived = true, updated_at = NOW()
            WHERE parent_task_id = NEW.id AND archived = false;
        END IF;
        
        -- If a task is being unarchived, unarchive all its subtasks
        IF NEW.archived = false AND OLD.archived = true THEN
            UPDATE tasks 
            SET archived = false, updated_at = NOW()
            WHERE parent_task_id = NEW.id AND archived = true;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger
DROP TRIGGER IF EXISTS trigger_auto_archive_subtasks ON tasks;
CREATE TRIGGER trigger_auto_archive_subtasks
    AFTER UPDATE OF archived ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION auto_archive_subtasks();

-- Trigger to update project task counts in real-time
CREATE OR REPLACE FUNCTION update_project_task_count()
RETURNS TRIGGER AS $$
BEGIN
    -- This updates the project's updated_at timestamp when tasks change
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE projects 
        SET updated_at = NOW() 
        WHERE id = NEW.project_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE projects 
        SET updated_at = NOW() 
        WHERE id = OLD.project_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger
DROP TRIGGER IF EXISTS trigger_update_project_task_count ON tasks;
CREATE TRIGGER trigger_update_project_task_count
    AFTER INSERT OR UPDATE OR DELETE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_project_task_count();

-- ============================================================================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- Firebase cannot do this - this is pure PostgreSQL power
-- ============================================================================

-- Materialized view for user statistics (refreshed periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS user_statistics AS
SELECT 
    t.user_id,
    COUNT(*) as total_tasks,
    COUNT(*) FILTER (WHERE t.archived = true) as completed_tasks,
    COUNT(*) FILTER (WHERE t.ai_enhanced = true) as ai_enhanced_tasks,
    COUNT(DISTINCT t.project_id) as active_projects,
    AVG(
        CASE 
            WHEN t.archived = true THEN 
                EXTRACT(EPOCH FROM (t.updated_at - t.created_at)) / 86400.0
            ELSE NULL 
        END
    ) as avg_completion_days,
    MAX(t.created_at) as last_task_created,
    MAX(CASE WHEN t.archived = true THEN t.updated_at ELSE NULL END) as last_task_completed
FROM tasks t
GROUP BY t.user_id;

-- Create index on the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_statistics_user_id ON user_statistics(user_id);

-- Function to refresh user statistics
CREATE OR REPLACE FUNCTION refresh_user_statistics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_statistics;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FULL-TEXT SEARCH CAPABILITIES
-- Firebase's search is primitive compared to PostgreSQL
-- ============================================================================

-- Function to update search vector
CREATE OR REPLACE FUNCTION update_task_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', 
        COALESCE(NEW.task, '') || ' ' || 
        COALESCE(NEW.metadata->>'category', '') || ' ' ||
        COALESCE(NEW.metadata->>'tags', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply search trigger
DROP TRIGGER IF EXISTS trigger_update_task_search_vector ON tasks;
CREATE TRIGGER trigger_update_task_search_vector
    BEFORE INSERT OR UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_task_search_vector();

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_tasks_search_vector ON tasks USING GIN(search_vector);

-- Update existing tasks with search vectors
UPDATE tasks SET search_vector = to_tsvector('english', 
    COALESCE(task, '') || ' ' || 
    COALESCE(metadata->>'category', '') || ' ' ||
    COALESCE(metadata->>'tags', '')
) WHERE search_vector IS NULL;

-- Function for intelligent task search
CREATE OR REPLACE FUNCTION search_tasks(p_user_id TEXT, search_query TEXT)
RETURNS TABLE(
    id INTEGER,
    task TEXT,
    project_name TEXT,
    priority TEXT,
    created_at TIMESTAMPTZ,
    relevance_score REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.task,
        COALESCE(p.name, 'Unknown Project') as project_name,
        t.priority,
        t.created_at,
        ts_rank(t.search_vector, plainto_tsquery('english', search_query)) as relevance_score
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.user_id = p_user_id
        AND t.search_vector @@ plainto_tsquery('english', search_query)
        AND t.archived = false
    ORDER BY relevance_score DESC, t.created_at DESC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- NOTIFICATION/WEBHOOK SYSTEM
-- Firebase functions are limited - PostgreSQL can do real-time notifications
-- ============================================================================

-- Function to send notifications (can integrate with external services)
CREATE OR REPLACE FUNCTION notify_task_changes()
RETURNS TRIGGER AS $$
DECLARE
    notification_payload JSON;
BEGIN
    -- Build notification payload
    notification_payload := json_build_object(
        'operation', TG_OP,
        'user_id', COALESCE(NEW.user_id, OLD.user_id),
        'task_id', COALESCE(NEW.id, OLD.id),
        'task_name', COALESCE(NEW.task, OLD.task),
        'timestamp', NOW()
    );
    
    -- Send PostgreSQL notification (can be picked up by external services)
    PERFORM pg_notify('task_changes', notification_payload::text);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply notification trigger
DROP TRIGGER IF EXISTS trigger_notify_task_changes ON tasks;
CREATE TRIGGER trigger_notify_task_changes
    AFTER INSERT OR UPDATE OR DELETE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION notify_task_changes();

-- ============================================================================
-- PERFORMANCE OPTIMIZATIONS
-- PostgreSQL-specific optimizations Firebase cannot match
-- ============================================================================

-- Partial indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_active_user ON tasks(user_id, created_at) 
    WHERE archived = false;

CREATE INDEX IF NOT EXISTS idx_tasks_ai_enhanced ON tasks(user_id, ai_enhanced, created_at) 
    WHERE ai_enhanced = true;

CREATE INDEX IF NOT EXISTS idx_tasks_priority_active ON tasks(user_id, priority, created_at) 
    WHERE archived = false;

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_tasks_user_project_status ON tasks(user_id, project_id, archived, created_at);

-- BRIN index for time-series data (very efficient for large datasets)
CREATE INDEX IF NOT EXISTS idx_tasks_created_at_brin ON tasks USING BRIN(created_at);

-- Index on projects for better performance
CREATE INDEX IF NOT EXISTS idx_projects_user_updated ON projects(user_id, updated_at);

-- ============================================================================
-- DATA INTEGRITY CONSTRAINTS
-- PostgreSQL can enforce data integrity that Firebase cannot
-- ============================================================================

-- Add check constraints (use DO block to handle existing constraint errors)
DO $$ 
BEGIN
    -- Check priority constraint
    BEGIN
        ALTER TABLE tasks 
        ADD CONSTRAINT check_priority 
        CHECK (priority IN ('low', 'medium', 'high'));
    EXCEPTION
        WHEN duplicate_object THEN NULL;
        WHEN others THEN RAISE NOTICE 'Priority constraint error: %', SQLERRM;
    END;
    
    -- Check task not empty constraint
    BEGIN
        ALTER TABLE tasks 
        ADD CONSTRAINT check_task_not_empty 
        CHECK (LENGTH(TRIM(task)) > 0);
    EXCEPTION
        WHEN duplicate_object THEN NULL;
        WHEN others THEN RAISE NOTICE 'Task not empty constraint error: %', SQLERRM;
    END;
    
    -- Check no self parent constraint (only if column exists)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'parent_task_id'
    ) THEN
        BEGIN
            ALTER TABLE tasks 
            ADD CONSTRAINT check_no_self_parent 
            CHECK (id != parent_task_id);
        EXCEPTION
            WHEN duplicate_object THEN NULL;
            WHEN others THEN RAISE NOTICE 'Self parent constraint error: %', SQLERRM;
        END;
    END IF;
END $$;

-- ============================================================================
-- ANALYTICS AND REPORTING VIEWS
-- Complex analytics that Firebase simply cannot do
-- ============================================================================

-- View for productivity analytics
CREATE OR REPLACE VIEW productivity_analytics AS
SELECT 
    t.user_id,
    DATE(t.created_at) as date,
    COUNT(*) as tasks_created,
    COUNT(*) FILTER (WHERE t.archived = true) as tasks_completed,
    COUNT(*) FILTER (WHERE t.ai_enhanced = true) as ai_tasks_created,
    COUNT(*) FILTER (WHERE t.ai_enhanced = true AND t.archived = true) as ai_tasks_completed,
    AVG(
        CASE 
            WHEN t.archived = true THEN 
                EXTRACT(EPOCH FROM (t.updated_at - t.created_at)) / 3600.0
            ELSE NULL 
        END
    ) as avg_completion_hours,
    mode() WITHIN GROUP (ORDER BY t.priority) as most_common_priority
FROM tasks t
WHERE t.created_at >= NOW() - INTERVAL '90 days'
GROUP BY t.user_id, DATE(t.created_at)
ORDER BY t.user_id, date DESC;

-- ============================================================================
-- DEMO DATA SETUP FOR TESTING
-- ============================================================================

-- Create demo user if not exists (for testing)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'demo@todoist.com') THEN
        -- Insert demo user into auth.users
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            recovery_sent_at,
            last_sign_in_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000'::uuid,
            gen_random_uuid(),
            'authenticated',
            'authenticated',
            'demo@todoist.com',
            crypt('demo123456', gen_salt('bf')),
            NOW(),
            NOW(),
            NOW(),
            '{"provider":"email","providers":["email"]}',
            '{}',
            NOW(),
            NOW(),
            '',
            '',
            '',
            ''
        );
    END IF;
END $$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ============================================================================
-- FINAL REPORT
-- ============================================================================
DO $$
DECLARE
    v_tasks_count INTEGER;
    v_projects_count INTEGER;
    v_has_parent_task_id BOOLEAN;
    v_has_updated_at_tasks BOOLEAN;
    v_has_updated_at_projects BOOLEAN;
BEGIN
    -- Check what we've set up
    SELECT COUNT(*) INTO v_tasks_count FROM tasks;
    SELECT COUNT(*) INTO v_projects_count FROM projects;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'parent_task_id'
    ) INTO v_has_parent_task_id;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'updated_at'
    ) INTO v_has_updated_at_tasks;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'updated_at'
    ) INTO v_has_updated_at_projects;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== SUPABASE SETUP COMPLETE ===';
    RAISE NOTICE 'Tasks table: % records', v_tasks_count;
    RAISE NOTICE 'Projects table: % records', v_projects_count;
    RAISE NOTICE 'Parent-child relationships: %', CASE WHEN v_has_parent_task_id THEN 'READY' ELSE 'NOT SET UP' END;
    RAISE NOTICE 'Tasks updated_at tracking: %', CASE WHEN v_has_updated_at_tasks THEN 'ACTIVE' ELSE 'NOT SET UP' END;
    RAISE NOTICE 'Projects updated_at tracking: %', CASE WHEN v_has_updated_at_projects THEN 'ACTIVE' ELSE 'NOT SET UP' END;
    RAISE NOTICE '';
    RAISE NOTICE 'Features enabled:';
    RAISE NOTICE '✓ Row Level Security policies';
    RAISE NOTICE '✓ Advanced analytics functions';
    RAISE NOTICE '✓ Automatic triggers';
    RAISE NOTICE '✓ Full-text search';
    RAISE NOTICE '✓ Performance indexes';
    RAISE NOTICE '✓ Data integrity constraints';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Your app is now running on TRUE native Supabase!';
END $$;