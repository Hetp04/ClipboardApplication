import { useEffect, useState } from 'react';
import '../styles/SplashScreen.css';

const SplashScreen: React.FC<{ onFinish: () => void }> = ({ onFinish }) => {
  const [fadeOut, setFadeOut] = useState(false);

  // Handle animation and cleanup
  useEffect(() => {
    // Show splash screen for 2.8 seconds before starting fade out
    const timer = setTimeout(() => {
      setFadeOut(true);
      // After fade out animation, call onFinish
      setTimeout(onFinish, 700); // Match CSS transition duration
    }, 2800);

    return () => clearTimeout(timer);
  }, [onFinish]);

  const logoText = "SnipStack";

  return (
    <div className={`splash-screen ${fadeOut ? 'fade-out' : ''}`}>
      {/* Centered Content */}
      <div className="splash-content-container">
        <div className="logo-container">
          <div className="logo-reveal">
            {logoText.split('').map((char, index) => (
              <span
                key={index}
                className="logo-char"
                style={{ animationDelay: `${0.08 * index + 0.3}s` }} // Staggered fade-in
              >
                {char}
              </span>
            ))}
          </div>
          <div className="logo-underline"></div>
        </div>
        <div className="tagline">
          <span>Your second brain for everything you copy</span>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen; 