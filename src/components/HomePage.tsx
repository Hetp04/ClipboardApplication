import { useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/HomePage.css';
import LoginForm from './LoginForm';
import SignupForm from './SignupForm';

const HomePage = () => {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  
  const toggleAuthMode = () => {
    setAuthMode(authMode === 'login' ? 'signup' : 'login');
  };

  return (
    <div className="split-layout">
      <div className="left-panel">
        <div className="brand">
          <h1 className="logo">SnipStack</h1>
          <p className="tagline">Your second brain for everything you copy</p>
        </div>
        
        <div className="info-content">
          <div className="feature-grid">
            <div className="feature">
              <div className="feature-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 11 12 14 22 4"></polyline>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                </svg>
              </div>
              <div className="feature-text">
                <h3>Automatic organization</h3>
                <p>Every snippet categorized without extra work</p>
              </div>
            </div>
            
            <div className="feature">
              <div className="feature-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </div>
              <div className="feature-text">
                <h3>Instant search</h3>
                <p>Find exactly what you need in milliseconds</p>
              </div>
            </div>
            
            <div className="feature">
              <div className="feature-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                  <path d="M2 17l10 5 10-5"></path>
                  <path d="M2 12l10 5 10-5"></path>
                </svg>
              </div>
              <div className="feature-text">
                <h3>Cross-device sync</h3>
                <p>Access your snippets from anywhere</p>
              </div>
            </div>
          </div>
          
          <div className="how-it-works">
            <h4>How SnipStack Works</h4>
            <div className="steps-container">
              <div className="step">
                <div className="step-number">1</div>
                <div className="step-content">
                  <h5>Copy</h5>
                  <p>Text or images</p>
                </div>
              </div>
              <div className="step">
                <div className="step-number">2</div>
                <div className="step-content">
                  <h5>Organize</h5>
                  <p>Auto-categorized</p>
                </div>
              </div>
              <div className="step">
                <div className="step-number">3</div>
                <div className="step-content">
                  <h5>Find</h5>
                  <p>Quick retrieval</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="hero-image">
            <div className="image-placeholder">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="2" ry="2"></rect>
                <line x1="6" y1="6" x2="6.01" y2="6"></line>
                <line x1="10" y1="6" x2="18" y2="6"></line>
                <line x1="6" y1="10" x2="18" y2="10"></line>
                <line x1="6" y1="14" x2="18" y2="14"></line>
                <line x1="6" y1="18" x2="14" y2="18"></line>
              </svg>
            </div>
          </div>
        </div>
      </div>
      
      <div className="right-panel">
        <div className="auth-container">
          <div className="auth-tabs">
            <button 
              className={`auth-tab ${authMode === 'login' ? 'active' : ''}`}
              onClick={() => setAuthMode('login')}
            >
              Login
            </button>
            <button 
              className={`auth-tab ${authMode === 'signup' ? 'active' : ''}`}
              onClick={() => setAuthMode('signup')}
            >
              Sign Up
            </button>
          </div>
          
          <div className="auth-form-container">
            {authMode === 'login' ? <LoginForm /> : <SignupForm />}
          </div>
          
          <div className="auth-footer">
            {authMode === 'login' ? (
              <p>
                <a href="#" className="text-button" onClick={(e) => { e.preventDefault(); console.log('Reset password'); }}>
                  Forgot password?
                </a>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button className="text-button" onClick={toggleAuthMode}>
                  Sign in
                </button>
              </p>
            )}
          </div>
          
          <div className="guest-link">
            <Link to="/guest" className="stay-logged-out-button">Stay as logged out</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage; 