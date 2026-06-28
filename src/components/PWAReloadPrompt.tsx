import { useRegisterSW } from 'virtual:pwa-register/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, RefreshCw, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { getContrastColor } from '../utils/colorUtils';

export default function PWAReloadPrompt() {
    const { theme } = useAppContext();
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('PWA Service Worker registered:', r);
        },
        onRegisterError(error) {
            console.error('PWA Service Worker registration error:', error);
        },
    });

    return (
        <AnimatePresence>
            {needRefresh && (
                <motion.div
                    className="fixed bottom-24 left-4 right-4 md:bottom-8 md:right-8 md:left-auto md:w-96 z-[9999] rounded-2xl md:rounded-3xl p-4 md:p-5 border shadow-2xl backdrop-blur-xl flex flex-col gap-3"
                    initial={{ opacity: 0, y: 50, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 50, scale: 0.95 }}
                    style={{
                        backgroundColor: theme.surface,
                        borderColor: theme.border,
                        color: theme.text,
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)'
                    }}
                >
                    <div className="flex items-start gap-3">
                        <div 
                            className="p-2 rounded-xl flex-shrink-0 flex items-center justify-center"
                            style={{ backgroundColor: `${theme.primary}20` }}
                        >
                            <Sparkles size={20} style={{ color: theme.primary }} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm md:text-base leading-tight mb-1">Update Available!</h4>
                            <p className="text-[11px] md:text-xs font-semibold opacity-75 leading-normal">
                                A fresh version of ArtSpace is ready. Update now to experience new features and design optimizations.
                            </p>
                        </div>
                        <button
                            onClick={() => setNeedRefresh(false)}
                            className="opacity-50 hover:opacity-100 transition-opacity p-1"
                            title="Remind Later"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <div className="flex gap-2.5 mt-1">
                        <button
                            onClick={() => setNeedRefresh(false)}
                            className="flex-1 py-2 text-xs font-bold rounded-xl border transition-colors hover:bg-black/5"
                            style={{ borderColor: theme.border, color: theme.text }}
                        >
                            Later
                        </button>
                        <button
                            onClick={() => updateServiceWorker(true)}
                            className="flex-[2] py-2 text-xs font-black rounded-xl shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer"
                            style={{
                                backgroundColor: theme.primary,
                                color: getContrastColor(theme.primary)
                            }}
                        >
                            <RefreshCw size={14} className="animate-spin-slow" />
                            Update Now
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
