
import { motion, AnimatePresence } from 'framer-motion';

interface SplashScreenProps {
    onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
    // The automatic timeout has been replaced by the "Explore Art" button click



    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 z-10 flex flex-col items-center justify-center pointer-events-auto"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
                transition={{ duration: 1.2, ease: "easeInOut" }}
            >
                {/* Subtle gradient overlay to ensure text is readable against 3D background */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-black/20 pointer-events-none" />

                <div className="relative z-20 text-center flex flex-col items-center">
                    <motion.h1
                        className="text-6xl md:text-8xl font-bold mb-4 tracking-tight text-white"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2, duration: 1.2, ease: "easeOut" }}
                        style={{ textShadow: '0 4px 25px rgba(255,255,255,0.4)' }}
                    >
                        ArtSpace
                    </motion.h1>

                    <motion.p
                        className="text-xl md:text-2xl mb-12 font-medium text-gray-300"
                        initial={{ y: 30, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.4, duration: 0.8 }}
                    >
                        Your personal 3D art gallery
                    </motion.p>

                    <motion.button
                        onClick={onComplete}
                        className="group relative overflow-hidden rounded-full bg-white/10 px-12 py-4 text-xl backdrop-blur-md border border-white/10 transition-all hover:bg-white/20 hover:scale-105 active:scale-95 text-white font-semibold cursor-pointer pointer-events-auto shadow-[0_10px_30px_rgba(255,255,255,0.1)] hover:shadow-[0_15px_40px_rgba(255,255,255,0.2)]"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.6, duration: 0.8 }}
                    >
                        <span className="relative z-10 flex items-center gap-2">
                            Explore Art
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-gray-400/10 opacity-0 transition-opacity group-hover:opacity-100" />
                    </motion.button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
