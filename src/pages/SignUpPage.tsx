import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Lock, Mail, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { getContrastColor } from '../utils/colorUtils';

export default function SignUpPage() {
    const navigate = useNavigate();
    const { signInWithGoogle, signupWithEmail, user } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSigningUp, setIsSigningUp] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { theme } = useAppContext();

    useEffect(() => {
        if (user && !isSigningUp) {
            navigate('/dashboard');
        }
    }, [user, isSigningUp, navigate]);

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();

        // Basic frontend validation
        if (password.length < 6) {
            setError('Password should be at least 6 characters.');
            return;
        }

        setLoading(true);
        setIsSigningUp(true);
        setError(null);

        try {
            await signupWithEmail(email, password);
            // On success, the AuthContext onAuthStateChanged will trigger,
            // create their UserProfile document, and then our effect will redirect them to /dashboard.
            // However, we want them to go to /setup-profile to pick their name and avatar.
            // Since onAuthStateChanged is asynchronous and might redirect them to dashboard first,
            // we will let the new login handle routing or we can force navigate.
            navigate('/setup-profile', { state: { username } });
        } catch (err: any) {
            if (err.code === 'auth/email-already-in-use') {
                setError('An account with this email already exists.');
            } else if (err.code === 'auth/weak-password') {
                setError('Password is too weak.');
            } else {
                setError(err.message || 'Failed to create an account.');
            }
            setIsSigningUp(false);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignUp = async () => {
        try {
            setLoading(true);
            setError(null);
            await signInWithGoogle();
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.message || "Failed to sign up with Google");
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div
            className="absolute inset-0 flex items-center justify-center z-10 p-4"
            initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
        >
            <motion.div
                className="w-full max-w-md rounded-[2rem] p-8 backdrop-blur-xl border shadow-xl"
                initial={{ y: 50 }}
                animate={{ y: 0 }}
                transition={{ delay: 0.2, duration: 0.6, type: "spring", bounce: 0.4 }}
                style={{
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.2), 0 0 40px rgba(0, 0, 0, 0.1)'
                }}
            >
                <h2 className="text-4xl font-bold mb-8 text-center tracking-tight" style={{ color: theme.text }}>Create Account</h2>

                <form className="flex flex-col gap-5" onSubmit={handleSignUp}>
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors" style={{ color: theme.text, opacity: 0.5 }}>
                            <Mail size={20} />
                        </div>
                        <input
                            type="email"
                            placeholder="Email Address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full rounded-2xl border px-12 py-4 focus:outline-none focus:ring-4 transition-all font-sans font-medium"
                            style={{
                                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                borderColor: theme.border,
                                color: theme.text,
                                '--tw-ring-color': theme.primary
                            } as any}
                        />
                    </div>

                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors" style={{ color: theme.text, opacity: 0.5 }}>
                            <User size={20} />
                        </div>
                        <input
                            type="text"
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            className="w-full rounded-2xl border px-12 py-4 focus:outline-none focus:ring-4 transition-all font-sans font-medium"
                            style={{
                                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                borderColor: theme.border,
                                color: theme.text,
                                '--tw-ring-color': theme.primary
                            } as any}
                        />
                    </div>

                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors" style={{ color: theme.text, opacity: 0.5 }}>
                            <Lock size={20} />
                        </div>
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full rounded-2xl border px-12 py-4 focus:outline-none focus:ring-4 transition-all font-sans font-medium"
                            style={{
                                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                borderColor: theme.border,
                                color: theme.text,
                                '--tw-ring-color': theme.primary
                            } as any}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors hover:opacity-100"
                            style={{ color: theme.text, opacity: 0.5 }}
                        >
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-red-500 text-sm font-semibold bg-red-100/50 p-3 rounded-xl border border-red-200">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-2xl py-4 mt-2 text-lg font-bold shadow-md hover:shadow-lg active:scale-[0.98] transition-all border disabled:opacity-50 flex justify-center items-center"
                        style={{ backgroundColor: theme.primary, color: getContrastColor(theme.primary), borderColor: theme.border }}
                    >
                        {loading ? <Loader2 className="animate-spin" /> : 'Sign Up'}
                    </button>
                </form>

                <div className="mt-8 text-center text-sm font-semibold" style={{ color: theme.text }}>
                    Already have an account? <span onClick={() => navigate('/login')} className="hover:underline font-bold cursor-pointer" style={{ color: theme.primary }}>Login</span>
                </div>

                <div className="mt-8 flex justify-center gap-4">
                    <button
                        type="button"
                        onClick={handleGoogleSignUp}
                        disabled={loading}
                        className="flex h-12 items-center justify-center rounded-2xl border shadow-sm hover:shadow-md transition-all font-bold cursor-pointer px-6 w-full gap-3 disabled:opacity-50"
                        style={{ backgroundColor: 'white', borderColor: theme.border, color: '#3c2a2b' }}
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Sign Up with Google
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}
