import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://demo.supabase.co';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'demo-key';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Firebase-compatible interface for easy migration
const firebase = {
  firestore: () => ({
    collection: (collectionName) => ({
      add: async (data) => {
        const { data: result, error } = await supabase
          .from(collectionName)
          .insert([{ ...data, created_at: new Date().toISOString() }])
          .select()
          .single();
        
        if (error) throw error;
        return { id: result.id };
      },
      
      where: (field, operator, value) => ({
        get: async () => {
          let query = supabase.from(collectionName).select('*');
          
          // Convert Firestore operators to Supabase
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
          
          const { data, error } = await query;
          if (error) throw error;
          
          return {
            docs: (data || []).map(item => ({
              id: item.id,
              data: () => item
            }))
          };
        }
      }),
      
      doc: (docId) => ({
        update: async (updateData) => {
          const { error } = await supabase
            .from(collectionName)
            .update(updateData)
            .eq('id', docId);
          
          if (error) throw error;
        },
        
        delete: async () => {
          const { error } = await supabase
            .from(collectionName)
            .delete()
            .eq('id', docId);
          
          if (error) throw error;
        }
      })
    })
  }),
  
  FieldValue: {
    serverTimestamp: () => new Date().toISOString()
  }
};

// Export both for flexibility
export { firebase, supabase };