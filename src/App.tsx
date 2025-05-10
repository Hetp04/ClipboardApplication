import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import DraggableMainScreen from './components/DraggableMainScreen';
import HomePage from './components/HomePage';
import SplashScreen from './components/SplashScreen';

function App() {
  const [showSplash, setShowSplash] = useState(true);

  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  return (
    <>
      {showSplash ? (
        <SplashScreen onFinish={handleSplashFinish} />
      ) : (
        <Router>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/main" element={<DraggableMainScreen />} />
            <Route path="/guest" element={<DraggableMainScreen />} />
          </Routes>
        </Router>
      )}
    </>
  );
}

export default App;
