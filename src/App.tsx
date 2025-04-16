import { useState, useEffect } from 'react';
import HomePage from './components/HomePage';
import SplashScreen from './components/SplashScreen';
import './App.css';

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [appReady, setAppReady] = useState(false);

  const handleSplashFinish = () => {
    // Keep splash visible but indicate app is ready to load content in background
    setAppReady(true);
    
    // Only hide splash after content is loaded
    setTimeout(() => {
      setShowSplash(false);
    }, 500);
  };

  return (
    <div className="app">
      {/* Always render HomePage, but initially hidden */}
      <div className={`home-container ${appReady ? 'visible' : 'hidden'}`}>
        <HomePage />
      </div>
      
      {showSplash && <SplashScreen onFinish={handleSplashFinish} />}
    </div>
  );
}

export default App;
