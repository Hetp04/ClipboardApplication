import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './components/HomePage';
// import GuestPage from './components/GuestPage';
import MainScreen from './components/MainScreen';
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
      {/* Always render content, but initially hidden */}
      <div className={`content-container ${appReady ? 'visible' : 'hidden'}`}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/guest" element={<MainScreen />} />
            <Route path="/main" element={<MainScreen />} />
          </Routes>
        </BrowserRouter>
      </div>
      
      {showSplash && <SplashScreen onFinish={handleSplashFinish} />}
    </div>
  );
}

export default App;
