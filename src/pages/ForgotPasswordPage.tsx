import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { getContrastColor } from '../utils/colorUtils';

export default function ForgotPasswordPage() {
    const navigate = useNavigate();
    const [isSubmitted, setIsSubmitted] = useState(false);
    const { theme } = useAppContext();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitted(true);
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
                className="w-full max-w-md rounded-[2rem] p-8 backdrop-blur-xl border shadow-xl relative"
                initial={{ y: 50 }}
                animate={{ y: 0 }}
                transition={{ delay: 0.2, duration: 0.6, type: "spring", bounce: 0.4 }}
                style={{
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.2), 0 0 40px rgba(0, 0, 0, 0.1)'
                }}
            >
                <button
                    onClick={() => navigate('/login')}
                    className="absolute top-6 left-6 transition-colors"
                    style={{ color: theme.text, opacity: 0.5 }}
                    onMouseEnter={(e) => e.currentTarget.style.color = theme.primary}
                    onMouseLeave={(e) => { e.currentTarget.style.color = theme.text; e.currentTarget.style.opacity = '0.5'; }}
                >
                    <ArrowLeft size={24} />
                </button>

                <h2 className="text-3xl font-bold mb-4 mt-4 text-center tracking-tight" style={{ color: theme.text }}>Recover Password</h2>

                {!isSubmitted ? (
                    <>
                        <p className="text-center font-semibold mb-8 font-sans" style={{ color: theme.text, opacity: 0.7 }}>
                            Enter your email address and we'll send you a link to reset your password.
                        </p>

                        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors" style={{ color: theme.text, opacity: 0.5 }}>
                                    <Mail size={20} />
                                </div>
                                <input
                                    type="email"
                                    placeholder="Email Address"
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

                            <button
                                type="submit"
                                className="w-full rounded-2xl py-4 mt-2 text-lg font-bold shadow-md hover:shadow-lg active:scale-[0.98] transition-all border"
                                style={{ backgroundColor: theme.primary, color: getContrastColor(theme.primary), borderColor: theme.border }}
                            >
                                Send Reset Link
                            </button>
                        </form>
                    </>
                ) : (
                    <motion.div
                        className="flex flex-col items-center justify-center py-8"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                    >
                        <CheckCircle2 size={64} className="mb-4" style={{ color: theme.primary }} />
                        <h3 className="text-xl font-bold mb-2" style={{ color: theme.text }}>Check your inbox</h3>
                        <p className="text-center font-medium font-sans mb-8" style={{ color: theme.text, opacity: 0.7 }}>
                            We've sent a password reset link to your email.
                        </p>

                        <button
                            onClick={() => navigate('/login')}
                            className="w-full rounded-2xl py-4 text-lg font-bold transition-all border shadow-sm hover:shadow-md"
                            style={{ backgroundColor: 'white', borderColor: theme.border, color: '#1a1a1a' }}
                        >
                            Return to Login
                        </button>
                    </motion.div>
                )}
            </motion.div>
        </motion.div>
    );
}
