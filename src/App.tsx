import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { AnimatePresence } from 'framer-motion';

import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import DashboardPage from './pages/DashboardPage';
import ProfileSetupPage from './pages/ProfileSetupPage';
import GalleryPage from './pages/GalleryPage';
import Background3D from './components/Background3D';
import SplashScreen from './components/SplashScreen';
import { AppProvider, useAppContext } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/setup-profile" element={<ProfileSetupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/gallery/:id" element={<GalleryPage />} />
      </Routes>
    </AnimatePresence>
  );
}

function AppContent() {
  const { theme } = useAppContext();
  const [mousePosition, setMousePosition] = useState({ x: 0.5, y: 0.5 });
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <Router>
      <div
        className="relative w-screen h-screen overflow-hidden transition-colors duration-1000"
        style={{ backgroundColor: showSplash ? '#000000' : theme.background }}
      >
        {/* Splash Screen */}
        {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}

        {/* 3D Background */}
        <div className="absolute inset-0 z-0 transition-opacity duration-1000">
          <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
            <Background3D mousePosition={mousePosition} />
          </Canvas>
        </div>

        {/* Overlay Content */}
        {!showSplash && <AnimatedRoutes />}
      </div>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </AuthProvider>
  );
}

export default App;
