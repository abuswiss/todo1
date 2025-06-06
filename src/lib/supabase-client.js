import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://demo.supabase.co';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'demo-key';

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey);

// Field name conversion utilities
const convertToSnakeCase = (obj) => {
  const converted = {};
  Object.keys(obj).forEach(key => {
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    converted[snakeKey] = obj[key];
  });
  return converted;
};

const convertToCamelCase = (obj) => {
  const converted = {};
  Object.keys(obj).forEach(key => {
    const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    converted[camelKey] = obj[key];
  });
  return converted;
};

// Tasks API
export const tasksApi = {
  // Subscribe to real-time updates
  subscribe(userId, filters = {}, callback) {
    let query = supabase
      .from('tasks')
      .select('*');

    // Apply userId filter
    if (userId) {
      query = query.eq('user_id', userId);
    }

    // Apply additional filters
    Object.entries(filters).forEach(([key, value]) => {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (value !== undefined && value !== null) {
        query = query.eq(snakeKey, value);
      }
    });

    // Initial data fetch
    query.then(({ data, error }) => {
      if (error) {
        console.error('Error fetching tasks:', error);
        return;
      }
      callback(data?.map(convertToCamelCase) || []);
    });

    // Real-time subscription with intelligent updates
    const channel = supabase
      .channel(`tasks_realtime_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: this.collectionName
        },
        async (payload) => {
          // Smart handling of real-time events
          const { eventType, new: newRecord, old: oldRecord } = payload;
          
          try {
            // For user-specific data, check if this change affects current user
            if (userId && newRecord?.user_id !== userId && oldRecord?.user_id !== userId) {
              return; // Skip changes for other users
            }
            
            // Refetch filtered data to maintain consistency
            const { data, error } = await query;
            if (!error) {
              callback(data?.map(convertToCamelCase) || []);
            }
          } catch (error) {
            console.error('Error handling real-time update:', error);
            // Fallback to full refetch
            const { data, error: fallbackError } = await query;
            if (!fallbackError) {
              callback(data?.map(convertToCamelCase) || []);
            }
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  },

  // Create a new task
  async create(taskData) {
    const snakeData = convertToSnakeCase(taskData);
    const { data, error } = await supabase
      .from('tasks')
      .insert([snakeData])
      .select()
      .single();

    if (error) throw error;
    return convertToCamelCase(data);
  },

  // Update a task
  async update(id, updates) {
    const snakeData = convertToSnakeCase(updates);
    const { data, error } = await supabase
      .from('tasks')
      .update(snakeData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return convertToCamelCase(data);
  },

  // Delete a task
  async delete(id) {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  // Get tasks with filters
  async getAll(userId, filters = {}) {
    let query = supabase
      .from('tasks')
      .select('*');

    if (userId) {
      query = query.eq('user_id', userId);
    }

    Object.entries(filters).forEach(([key, value]) => {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (value !== undefined && value !== null) {
        query = query.eq(snakeKey, value);
      }
    });

    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) throw error;
    return data?.map(convertToCamelCase) || [];
  }
};

// Projects API
export const projectsApi = {
  // Subscribe to real-time updates
  subscribe(userId, callback) {
    let query = supabase
      .from('projects')
      .select('*');

    if (userId) {
      query = query.eq('user_id', userId);
    }

    // Initial data fetch
    query.order('id').then(({ data, error }) => {
      if (error) {
        console.error('Error fetching projects:', error);
        return;
      }
      callback(data?.map(convertToCamelCase) || []);
    });

    // Real-time subscription
    const channel = supabase
      .channel(`projects_realtime_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects'
        },
        async () => {
          // Refetch data on any change
          const { data, error } = await query.order('id');
          if (!error) {
            callback(data?.map(convertToCamelCase) || []);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  },

  // Create a new project
  async create(projectData) {
    const snakeData = convertToSnakeCase(projectData);
    const { data, error } = await supabase
      .from('projects')
      .insert([snakeData])
      .select()
      .single();

    if (error) throw error;
    return convertToCamelCase(data);
  },

  // Update a project
  async update(id, updates) {
    const snakeData = convertToSnakeCase(updates);
    const { data, error } = await supabase
      .from('projects')
      .update(snakeData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return convertToCamelCase(data);
  },

  // Delete a project
  async delete(id) {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  // Get all projects
  async getAll(userId) {
    let query = supabase
      .from('projects')
      .select('*');

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.order('id');
    
    if (error) throw error;
    return data?.map(convertToCamelCase) || [];
  }
};

// Helper functions for date filtering
export const dateFilters = {
  today: () => {
    const today = new Date();
    return today.toLocaleDateString('en-GB'); // DD/MM/YYYY format
  },
  
  next7Days: (date) => {
    const taskDate = new Date(date.split('/').reverse().join('-')); // Convert DD/MM/YYYY to YYYY-MM-DD
    const today = new Date();
    const diffDays = Math.ceil((taskDate - today) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  }
};