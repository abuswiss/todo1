import { useState } from 'react';
import { useAuth } from '../context/auth-context';

export const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, signInAsDemo, loading, error } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSignUp) {
      await signUpWithEmail(email, password);
    } else {
      await signInWithEmail(email, password);
    }
  };

  const handleDemoLogin = async () => {
    await signInAsDemo();
  };

  const handleGoogleLogin = async () => {
    await signInWithGoogle();
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <img src="images/logo.png" alt="Todoist" className="auth-logo" />
        <h1>{isSignUp ? 'Sign Up' : 'Sign In'}</h1>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="input-group">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength="6"
            />
          </div>
          
          <button type="submit" disabled={loading} className="auth-button primary">
            {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>
        
        <div className="auth-divider">or</div>
        
        <button 
          onClick={handleGoogleLogin} 
          disabled={loading}
          className="auth-button google"
        >
          Continue with Google
        </button>
        
        <button 
          onClick={handleDemoLogin} 
          disabled={loading}
          className="auth-button demo"
        >
          Try Demo Account
        </button>
        
        <p className="auth-toggle">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button 
            type="button" 
            onClick={() => setIsSignUp(!isSignUp)}
            className="auth-link"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  );
};