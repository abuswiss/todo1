import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://demo.supabase.co';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'demo-key';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Firebase-compatible query builder
class SupabaseQuery {
  constructor(collectionName) {
    this.collectionName = collectionName;
    this.filters = [];
    this.orderByField = null;
    this.orderByDirection = 'asc';
  }

  // Convert camelCase field names to snake_case for database
  convertFieldName(field) {
    // For projects table, some fields don't need conversion
    if (this.collectionName === 'projects') {
      const projectFieldMap = {
        'userId': 'user_id',
        'createdAt': 'created_at',
        'projectId': 'id' // Special case: projectId maps to id for projects table
      };
      return projectFieldMap[field] || field;
    }
    
    const fieldMap = {
      'projectId': 'project_id',
      'userId': 'user_id',
      'aiEnhanced': 'ai_enhanced',
      'parentTaskId': 'parent_task_id',
      'createdAt': 'created_at'
    };
    return fieldMap[field] || field;
  }

  where(field, operator, value) {
    this.filters.push({ field: this.convertFieldName(field), operator, value });
    return this;
  }

  orderBy(field, direction = 'asc') {
    this.orderByField = field;
    this.orderByDirection = direction;
    return this;
  }

  // Convert snake_case back to camelCase for app
  convertDataFromDb(item) {
    if (this.collectionName === 'projects') {
      return {
        id: item.id,
        name: item.name,
        userId: item.user_id,
        projectId: item.id, // For projects, projectId is the same as id
        createdAt: item.created_at
      };
    }
    
    return {
      id: item.id,
      task: item.task,
      projectId: item.project_id,
      date: item.date,
      priority: item.priority,
      archived: item.archived,
      userId: item.user_id,
      aiEnhanced: item.ai_enhanced,
      metadata: item.metadata,
      parentTaskId: item.parent_task_id,
      createdAt: item.created_at
    };
  }

  async get() {
    let query = supabase.from(this.collectionName).select('*');
    
    // Apply filters
    this.filters.forEach(({ field, operator, value }) => {
      switch (operator) {
        case '==':
          query = query.eq(field, value);
          break;
        case '!=':
          query = query.neq(field, value);
          break;
        case '>':
          query = query.gt(field, value);
          break;
        case '>=':
          query = query.gte(field, value);
          break;
        case '<':
          query = query.lt(field, value);
          break;
        case '<=':
          query = query.lte(field, value);
          break;
        default:
          query = query.eq(field, value);
      }
    });

    // Apply ordering
    if (this.orderByField) {
      query = query.order(this.convertFieldName(this.orderByField), { ascending: this.orderByDirection === 'asc' });
    }

    const { data, error } = await query;
    if (error) throw error;

    return {
      docs: (data || []).map((item) => ({
        id: item.id,
        data: () => this.convertDataFromDb(item),
      })),
    };
  }

  onSnapshot(callback) {
    // For now, we'll simulate real-time updates with polling
    // In a production app, you'd want to use Supabase real-time subscriptions
    const pollData = async () => {
      try {
        const result = await this.get();
        callback(result);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    // Initial load
    pollData();

    // Poll every 5 seconds (you can adjust this)
    const interval = setInterval(pollData, 5000);

    // Return unsubscribe function
    return () => clearInterval(interval);
  }
}

// Firebase-compatible interface for easy migration
const firebase = {
  firestore: () => ({
    collection: (collectionName) => ({
      add: async (data) => {
        // Convert camelCase to snake_case for database
        const dbData = {
          task: data.task,
          project_id: data.projectId,
          date: data.date,
          priority: data.priority,
          archived: data.archived,
          user_id: data.userId,
          ai_enhanced: data.aiEnhanced,
          metadata: data.metadata,
          created_at: new Date().toISOString()
        };

        const { data: result, error } = await supabase
          .from(collectionName)
          .insert([dbData])
          .select()
          .single();

        if (error) throw error;
        return { id: result.id };
      },

      where: (field, operator, value) => {
        const query = new SupabaseQuery(collectionName);
        return query.where(field, operator, value);
      },

      orderBy: (field, direction) => {
        const query = new SupabaseQuery(collectionName);
        return query.orderBy(field, direction);
      },

      get: async () => {
        const query = new SupabaseQuery(collectionName);
        return query.get();
      },

      doc: (docId) => ({
        update: async (updateData) => {
          // Convert camelCase to snake_case for database
          const dbData = {};
          Object.keys(updateData).forEach(key => {
            if (key === 'archived' || key === 'task' || key === 'date' || key === 'priority') {
              dbData[key] = updateData[key];
            } else if (key === 'projectId') {
              dbData[collectionName === 'projects' ? 'id' : 'project_id'] = updateData[key];
            } else if (key === 'userId') {
              dbData['user_id'] = updateData[key];
            } else if (key === 'aiEnhanced') {
              dbData['ai_enhanced'] = updateData[key];
            } else {
              dbData[key] = updateData[key];
            }
          });

          const { error } = await supabase
            .from(collectionName)
            .update(dbData)
            .eq('id', docId);

          if (error) throw error;
        },

        delete: async () => {
          const { error } = await supabase
            .from(collectionName)
            .delete()
            .eq('id', docId);

          if (error) throw error;
        },
      }),
    }),
  }),

  FieldValue: {
    serverTimestamp: () => new Date().toISOString(),
  },
};

// Export both for flexibility
export { firebase, supabase };