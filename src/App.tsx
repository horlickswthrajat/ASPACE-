import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { AnimatePresence } from 'framer-motion';
import React, { Suspense } from 'react';

// Simple Error Boundary component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("App Crash:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen flex flex-col items-center justify-center bg-[#010030] text-white p-10 text-center">
          <h1 className="text-4xl font-bold mb-4">Something went wrong.</h1>
          <p className="text-xl opacity-80 mb-8">The ArtSpace encountered a critical error. Please try refreshing the page.</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-white/10 hover:bg-white/20 rounded-full border border-white/20 transition-all"
          >
            Refresh App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

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
import { Analytics } from '@vercel/analytics/react';

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
        <Route path="*" element={<LoginPage />} /> {/* Fallback to login for any unknown routes */}
      </Routes>
    </AnimatePresence>
  );
}

function AppContent() {
  const { theme } = useAppContext();
  const location = useLocation();
  const [mousePosition, setMousePosition] = useState({ x: 0.5, y: 0.5 });
  const [showSplash, setShowSplash] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  const isGallery = location.pathname.startsWith('/gallery');
  const isDashboard = location.pathname.startsWith('/dashboard');

  useEffect(() => {
    const checkMobile = () => {
      const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
      const isSmall = window.innerWidth < 1024;
      setIsMobile(isTouch || isSmall);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isMobile) return;
      setMousePosition({
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isMobile]);

  // Determine if we should show the 3D WebGL background
  const show3DBackground = !isMobile && !isGallery && !isDashboard;

  return (
    <ErrorBoundary>
      <div
        className="relative w-screen h-screen overflow-hidden transition-colors duration-1000"
        style={{ backgroundColor: showSplash ? '#000000' : theme.background }}
      >
        {/* Splash Screen */}
        {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}

        {/* CSS Animated Fallback glows (low CPU, high fidelity) */}
        {!showSplash && (!show3DBackground || isDashboard) && (
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-40">
            <div 
              className="absolute -top-[20%] -left-[20%] w-[70%] h-[70%] rounded-full blur-[140px] mix-blend-screen animate-pulse" 
              style={{ backgroundColor: theme.primary }} 
            />
            <div 
              className="absolute -bottom-[20%] -right-[20%] w-[70%] h-[70%] rounded-full blur-[140px] mix-blend-screen animate-pulse" 
              style={{ backgroundColor: theme.light2 || theme.primary }} 
            />
          </div>
        )}

        {/* 3D Background (Only rendered on desktop auth pages to guarantee performance) */}
        {!showSplash && show3DBackground && (
          <div className="absolute inset-0 z-0 transition-opacity duration-1000 opacity-100">
            <Suspense fallback={null}>
              <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
                <Background3D mousePosition={mousePosition} />
              </Canvas>
            </Suspense>
          </div>
        )}

        {/* Overlay Content */}
        {!showSplash && <AnimatedRoutes />}
      </div>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <Router>
          <AppContent />
        </Router>
        <Analytics />
      </AppProvider>
    </AuthProvider>
  );
}

export default App;
