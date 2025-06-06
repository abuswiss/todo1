import { createContext, useContext, useEffect, useState } from 'react';
import { authService } from '../lib/supabase-native';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Get initial session using native auth service
    const getInitialSession = async () => {
      try {
        const user = await authService.getCurrentUser();
        setUser(user);
      } catch (error) {
        console.error('Error getting session:', error);
        setError(error.message);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes using native service
    const unsubscribe = authService.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);
      setUser(session?.user ?? null);
      setLoading(false);
      setError(null);
    });

    return () => unsubscribe && unsubscribe();
  }, []);

  const signInWithEmail = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const data = await authService.signIn(email, password);
      setLoading(false);
      return { data, error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      setError(error.message);
      setLoading(false);
      return { data: null, error };
    }
  };

  const signUpWithEmail = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const data = await authService.signUp(email, password);
      setLoading(false);
      return { data, error: null };
    } catch (error) {
      console.error('Sign up error:', error);
      setError(error.message);
      setLoading(false);
      return { data: null, error };
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await authService.signOut();
      setUser(null);
      setLoading(false);
      return { error: null };
    } catch (error) {
      console.error('Sign out error:', error);
      setError(error.message);
      setLoading(false);
      return { error };
    }
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authService.signInWithOAuth('google');
      setLoading(false);
      return { data, error: null };
    } catch (error) {
      console.error('Google sign in error:', error);
      setError(error.message);
      setLoading(false);
      return { data: null, error };
    }
  };

  // Development mode: auto-login with demo user
  const signInAsDemo = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authService.signIn('demo@todoist.com', 'demo123456');
      setLoading(false);
      return { data, error: null };
    } catch (error) {
      console.error('Demo sign in error:', error);
      setError(error.message);
      setLoading(false);
      return { data: null, error };
    }
  };

  const value = {
    user,
    loading,
    error,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    signInWithGoogle,
    signInAsDemo,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};