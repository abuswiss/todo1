/**
 * FIXED SUPABASE-NATIVE API CLIENT
 * Simple, working queries that don't break Supabase
 */

import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://demo.supabase.co';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'demo-key';

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * WORKING SUPABASE TASK OPERATIONS
 */
export const tasksService = {
  /**
   * Get tasks with simple queries that actually work
   */
  async getTasksWithRelations(userId, filters = {}) {
    let query = supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters.projectId && filters.projectId !== 'INBOX') {
      query = query.eq('project_id', filters.projectId);
    }
    
    if (filters.archived !== undefined) {
      query = query.eq('archived', filters.archived);
    }
    
    if (filters.priority) {
      query = query.eq('priority', filters.priority);
    }
    
    // Simple date filtering
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
   * Simple subscription that works
   */
  subscribeToTasks(userId, filters = {}, callback) {
    // Initial load
    this.getTasksWithRelations(userId, filters).then(callback);

    // Create unique channel name to avoid conflicts
    const channelName = `tasks_${userId}_${Date.now()}_${Math.random()}`;
    
    // Simple subscription
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${userId}`
        },
        async () => {
          // Refetch on any change
          try {
            const tasks = await this.getTasksWithRelations(userId, filters);
            callback(tasks);
          } catch (error) {
            console.error('Error fetching tasks after change:', error);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * Create task with simple insert
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
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update task with simple update
   */
  async updateTask(id, updates) {
    const updateData = {};
    
    if (updates.task !== undefined) updateData.task = updates.task;
    if (updates.projectId !== undefined) updateData.project_id = updates.projectId;
    if (updates.date !== undefined) updateData.date = updates.date;
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.archived !== undefined) updateData.archived = updates.archived;
    if (updates.aiEnhanced !== undefined) updateData.ai_enhanced = updates.aiEnhanced;
    if (updates.metadata !== undefined) updateData.metadata = updates.metadata;
    if (updates.parentTaskId !== undefined) updateData.parent_task_id = updates.parentTaskId;

    const { data, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete task
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
   * Bulk create subtasks
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
      .select();

    if (error) throw error;
    return data;
  }
};

/**
 * WORKING SUPABASE PROJECT OPERATIONS
 */
export const projectsService = {
  /**
   * Get projects with simple query
   */
  async getProjectsWithCounts(userId) {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Simple project subscription
   */
  subscribeToProjects(userId, callback) {
    // Initial load
    this.getProjectsWithCounts(userId).then(callback);

    // Create unique channel name
    const channelName = `projects_${userId}_${Date.now()}_${Math.random()}`;

    // Simple subscription
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
          filter: `user_id=eq.${userId}`
        },
        async () => {
          try {
            const projects = await this.getProjectsWithCounts(userId);
            callback(projects);
          } catch (error) {
            console.error('Error fetching projects after change:', error);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  async createProject(projectData) {
    const { data, error } = await supabase
      .from('projects')
      .insert([{
        id: projectData.id,
        name: projectData.name,
        user_id: projectData.userId
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteProject(id) {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }
};

/**
 * WORKING SUPABASE AUTH SERVICE
 */
export const authService = {
  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  },

  onAuthStateChange(callback) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
    return () => subscription?.unsubscribe();
  },

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  },

  async signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

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
 * SIMPLE ANALYTICS SERVICE
 */
export const analyticsService = {
  async getUserAnalytics(userId) {
    // Simple query that works
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    
    // Calculate analytics client-side
    const totalTasks = data.length;
    const completedTasks = data.filter(t => t.archived).length;
    const aiTasks = data.filter(t => t.ai_enhanced).length;
    
    return {
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      completion_rate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      ai_enhanced_percentage: totalTasks > 0 ? Math.round((aiTasks / totalTasks) * 100) : 0
    };
  }
};

export default {
  tasks: tasksService,
  projects: projectsService,
  auth: authService,
  analytics: analyticsService,
  supabase
};