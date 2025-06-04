-- Supabase Database Setup for AI Todo App
-- Run this SQL in Supabase Dashboard > SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tasks table
CREATE TABLE tasks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    task TEXT NOT NULL,
    project_id TEXT DEFAULT '1',
    date TEXT,
    priority TEXT DEFAULT 'medium',
    archived BOOLEAN DEFAULT false,
    user_id TEXT DEFAULT 'demo-user',
    ai_enhanced BOOLEAN DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create projects table
CREATE TABLE projects (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    user_id TEXT DEFAULT 'demo-user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default projects
INSERT INTO projects (id, name, user_id) VALUES 
    ('1', 'Inbox', 'demo-user'),
    ('2', 'Personal', 'demo-user'),
    ('3', 'Work', 'demo-user');

-- Create sample AI-enhanced task
INSERT INTO tasks (task, project_id, priority, ai_enhanced, metadata) VALUES (
    'Welcome to your AI-powered todo app!',
    '1',
    'medium',
    true,
    '{
        "originalInput": "Welcome to your AI-powered todo app!",
        "aiParsed": {
            "taskName": "Welcome to your AI-powered todo app!",
            "category": "general",
            "priority": "medium",
            "confidence": 0.9,
            "suggestions": ["Get started by adding your first task", "Try natural language like ''Call Sarah tomorrow''"]
        }
    }'::jsonb
);

-- Enable Row Level Security (RLS)
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for demo - customize for production)
CREATE POLICY "Enable all operations for all users" ON tasks
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all operations for all users" ON projects
    FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_archived ON tasks(archived);
CREATE INDEX idx_projects_user_id ON projects(user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();