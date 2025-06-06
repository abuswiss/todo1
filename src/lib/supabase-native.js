/**
 * TRUE SUPABASE-NATIVE API CLIENT
 * Leverages PostgreSQL's full power instead of thinking in Firebase terms
 */

import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://demo.supabase.co';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'demo-key';

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * NATIVE SUPABASE TASK OPERATIONS
 * Leveraging PostgreSQL relationships, triggers, and advanced features
 */
export const tasksService = {
  /**
   * Get tasks with full relational data in ONE query
   * This is the PostgreSQL way - not the Firebase way
   */
  async getTasksWithRelations(userId, filters = {}) {
    let query = supabase
      .from('tasks')
      .select(`
        *,
        project:projects!inner(id, name),
        subtasks:tasks!parent_task_id(*),
        parent_task:tasks!tasks_parent_task_id_fkey(id, task)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Apply filters using PostgreSQL's power
    if (filters.projectId && filters.projectId !== 'INBOX') {
      query = query.eq('project_id', filters.projectId);
    }
    
    if (filters.archived !== undefined) {
      query = query.eq('archived', filters.archived);
    }
    
    if (filters.priority) {
      query = query.eq('priority', filters.priority);
    }
    
    // PostgreSQL date filtering (better than client-side)
    if (filters.dateFilter === 'TODAY') {
      query = query.eq('date', new Date().toLocaleDateString('en-GB'));
    } else if (filters.dateFilter === 'NEXT_7') {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      query = query.lte('date', nextWeek.toLocaleDateString('en-GB'));
    }

    const { data, error } = await query;
    if (error) throw error;
    
    return data || [];
  },

  /**
   * Real-time subscription with PostgreSQL-specific filters
   * This is WAY more efficient than Firebase's approach
   */
  subscribeToTasks(userId, filters = {}, callback) {
    // Initial load with relations
    this.getTasksWithRelations(userId, filters).then(callback);

    // Real-time subscription with row-level filtering
    const channel = supabase
      .channel(`tasks_${userId}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${userId}` // PostgreSQL row-level filtering
        },
        async () => {
          // Refetch with relations on change
          const tasks = await this.getTasksWithRelations(userId, filters);
          callback(tasks);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  },

  /**
   * Create task with PostgreSQL RETURNING clause
   * Get the full created record with relations in one operation
   */
  async createTask(taskData) {
    const { data, error } = await supabase
      .from('tasks')
      .insert([{
        task: taskData.task,
        project_id: taskData.projectId || '1',
        date: taskData.date || null,
        priority: taskData.priority || 'medium',
        user_id: taskData.userId,
        ai_enhanced: taskData.aiEnhanced || false,
        metadata: taskData.metadata || {},
        parent_task_id: taskData.parentTaskId || null
      }])
      .select(`
        *,
        project:projects(id, name),
        parent_task:tasks!tasks_parent_task_id_fkey(id, task)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update with optimistic locking using updated_at
   * This is a PostgreSQL-specific feature
   */
  async updateTask(id, updates, expectedVersion = null) {
    let query = supabase
      .from('tasks')
      .update({
        task: updates.task,
        project_id: updates.projectId,
        date: updates.date,
        priority: updates.priority,
        archived: updates.archived,
        ai_enhanced: updates.aiEnhanced,
        metadata: updates.metadata,
        parent_task_id: updates.parentTaskId
      })
      .eq('id', id);

    // Optimistic locking check
    if (expectedVersion) {
      query = query.eq('updated_at', expectedVersion);
    }

    const { data, error } = await query
      .select(`
        *,
        project:projects(id, name),
        parent_task:tasks!tasks_parent_task_id_fkey(id, task)
      `)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error('Task was modified by another user. Please refresh and try again.');
      }
      throw error;
    }
    
    return data;
  },

  /**
   * Delete with CASCADE handling
   * PostgreSQL will automatically handle subtask deletion
   */
  async deleteTask(id) {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  /**
   * Bulk operations using PostgreSQL's power
   */
  async bulkCreateSubtasks(parentTaskId, subtasks) {
    const subtaskData = subtasks.map(subtask => ({
      task: subtask.task,
      project_id: subtask.projectId,
      date: subtask.date || null,
      priority: subtask.priority || 'low',
      user_id: subtask.userId,
      ai_enhanced: true,
      parent_task_id: parentTaskId,
      metadata: subtask.metadata || {}
    }));

    const { data, error } = await supabase
      .from('tasks')
      .insert(subtaskData)
      .select('*');

    if (error) throw error;
    return data;
  }
};

/**
 * NATIVE SUPABASE PROJECT OPERATIONS
 */
export const projectsService = {
  /**
   * Get projects with task counts using PostgreSQL aggregation
   */
  async getProjectsWithCounts(userId) {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        task_count:tasks(count)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Real-time project subscription
   */
  subscribeToProjects(userId, callback) {
    // Initial load
    this.getProjectsWithCounts(userId).then(callback);

    // Real-time updates
    const channel = supabase
      .channel(`projects_${userId}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
          filter: `user_id=eq.${userId}`
        },
        async () => {
          const projects = await this.getProjectsWithCounts(userId);
          callback(projects);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  },

  async createProject(projectData) {
    const { data, error } = await supabase
      .from('projects')
      .insert([{
        id: projectData.id,
        name: projectData.name,
        user_id: projectData.userId
      }])
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  async deleteProject(id) {
    // PostgreSQL CASCADE will handle related tasks
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }
};

/**
 * NATIVE SUPABASE AUTH SERVICE
 * Leveraging Supabase Auth instead of custom implementation
 */
export const authService = {
  /**
   * Get current user session
   */
  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  },

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
    return () => subscription?.unsubscribe();
  },

  /**
   * Sign in with email/password
   */
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  },

  /**
   * Sign up with email/password
   */
  async signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });
    if (error) throw error;
    return data;
  },

  /**
   * Sign out
   */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /**
   * OAuth sign in
   */
  async signInWithOAuth(provider) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) throw error;
    return data;
  }
};

/**
 * ADVANCED SUPABASE FEATURES
 */
export const analyticsService = {
  /**
   * Get user analytics using PostgreSQL functions
   */
  async getUserAnalytics(userId) {
    const { data, error } = await supabase
      .rpc('get_user_analytics', { user_id: userId });
    
    if (error) throw error;
    return data;
  },

  /**
   * Get productivity insights using PostgreSQL window functions
   */
  async getProductivityInsights(userId, days = 30) {
    const { data, error } = await supabase
      .rpc('get_productivity_insights', { 
        user_id: userId, 
        days_back: days 
      });
    
    if (error) throw error;
    return data;
  }
};

export default {
  tasks: tasksService,
  projects: projectsService,
  auth: authService,
  analytics: analyticsService,
  supabase
};