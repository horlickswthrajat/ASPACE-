import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, UserCheck, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { getContrastColor } from '../utils/colorUtils';
import ImageEditorModal from '../components/ImageEditorModal';
import { useAuth } from '../context/AuthContext';
import { getCloudinaryConfig } from '../utils/cloudinaryUtils';

const AVATAR_SEEDS = [
    'Felix', 'Aneka', 'Oliver', 'Mimi', 'Lola',
    'Jack', 'Buster', 'Jasper', 'Garfield', 'Cleo'
];

export default function ProfileSetupPage() {
    const navigate = useNavigate();
    const { setAvatarUrl, setName, theme } = useAppContext();
    const { updateUserProfile } = useAuth();
    const [name, setDisplayName] = useState('');
    const [seedIndex, setSeedIndex] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [customAvatar, setCustomAvatar] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const [editorOpen, setEditorOpen] = useState(false);
    const [rawSelectedImage, setRawSelectedImage] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const currentSeed = AVATAR_SEEDS[seedIndex];
    const defaultAvatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentSeed}`;
    const displayAvatarUrl = previewUrl || defaultAvatarUrl;

    const handleNextAvatar = () => {
        setSeedIndex((prev) => (prev + 1) % AVATAR_SEEDS.length);
        setCustomAvatar(null);
        setPreviewUrl('');
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setRawSelectedImage(e.target.files[0]);
            setEditorOpen(true);
        }
    };

    const handleEditorSave = (editedFile: File) => {
        setCustomAvatar(editedFile);
        setPreviewUrl(URL.createObjectURL(editedFile));
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsSaving(true);
        setError(null);

        try {
            let finalAvatarUrl = displayAvatarUrl;

            // Upload to Cloudinary if a custom avatar was cropped and selected
            if (customAvatar) {
                const config = getCloudinaryConfig();
                const formData = new FormData();
                formData.append('file', customAvatar);
                formData.append('upload_preset', config.uploadPreset);
                formData.append('folder', 'artspace_avatars');

                const cloudinaryRes = await fetch(config.uploadUrl, { 
                    method: 'POST', 
                    body: formData 
                }).then(r => r.json());

                if (cloudinaryRes.error) {
                    throw new Error(cloudinaryRes.error.message);
                }
                finalAvatarUrl = cloudinaryRes.secure_url;
            }

            // Update user profile in context and firestore
            // Pass an empty string for the username parameter to let the backend generate the auto-fallback
            await updateUserProfile(name, '', finalAvatarUrl);

            localStorage.setItem('artspace_user_name', name);
            localStorage.setItem('artspace_user_avatar', finalAvatarUrl);
            setName(name);
            setAvatarUrl(finalAvatarUrl);

            navigate('/dashboard');
        } catch (err: any) {
            console.error("Failed to save profile:", err);
            setError(err.message || "Failed to set up profile. Please try again.");
            setIsSaving(false);
        }
    };

    return (
        <motion.div
            className="absolute inset-0 flex items-center justify-center z-10 p-4"
            initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
            transition={{ duration: 0.8, ease: "easeOut" }}
        >
            <motion.div
                className="w-full max-w-md rounded-[2.5rem] p-10 backdrop-blur-xl border shadow-2xl relative overflow-hidden"
                initial={{ y: 50 }}
                animate={{ y: 0 }}
                transition={{ delay: 0.2, duration: 0.6, type: "spring", bounce: 0.4 }}
                style={{
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.2), 0 0 40px rgba(0, 0, 0, 0.1)'
                }}
            >
                <div className="text-center mb-8 relative z-10">
                    <h2 className="text-3xl font-bold tracking-tight mb-2" style={{ color: theme.text }}>Create Your Profile</h2>
                    <p className="font-medium" style={{ color: theme.text, opacity: 0.7 }}>Customize how others see you in ArtSpace.</p>
                </div>

                <form className="flex flex-col gap-8 relative z-10" onSubmit={handleSaveProfile}>
                    {/* Avatar Selection */}
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative group cursor-pointer" onClick={handleNextAvatar}>
                            <motion.div
                                className="w-32 h-32 rounded-full overflow-hidden shadow-lg outline outline-4 p-1 bg-white"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                style={{ outlineColor: theme.border }}
                            >
                                <AnimatePresence mode="wait">
                                    <motion.img
                                        key={displayAvatarUrl}
                                        src={displayAvatarUrl}
                                        alt="Avatar"
                                        className="w-full h-full object-cover rounded-full"
                                        initial={{ opacity: 0, rotate: -20, scale: 0.5 }}
                                        animate={{ opacity: 1, rotate: 0, scale: 1 }}
                                        exit={{ opacity: 0, rotate: 20, scale: 0.5 }}
                                        transition={{ duration: 0.3 }}
                                    />
                                </AnimatePresence>
                            </motion.div>

                            <div
                                className="absolute bottom-0 right-0 w-10 h-10 rounded-full shadow-md flex items-center justify-center border group-hover:scale-110 transition-transform"
                                style={{ backgroundColor: theme.surface, color: theme.primary, borderColor: theme.border }}
                            >
                                <RefreshCw size={20} strokeWidth={2.5} />
                            </div>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <p className="text-sm font-semibold" style={{ color: theme.text, opacity: 0.6 }}>Click avatar for random</p>
                            <span className="text-xs font-bold" style={{ color: theme.text, opacity: 0.4 }}>OR</span>
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-2 text-sm font-bold transition-colors px-4 py-1.5 rounded-full shadow-sm hover:brightness-110 border"
                                style={{ backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }}
                            >
                                <Upload size={14} /> Upload Custom Photo
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                accept="image/*"
                                className="hidden"
                            />
                        </div>
                    </div>

                    {/* Display Name Input */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold ml-2" style={{ color: theme.text }}>Display Name</label>
                        <div className="relative group">
                            <input
                                type="text"
                                placeholder="E.g. CreativeGenius99"
                                value={name}
                                onChange={(e) => setDisplayName(e.target.value)}
                                required
                                maxLength={20}
                                className="w-full rounded-2xl border px-6 py-4 focus:outline-none focus:ring-4 transition-all font-sans font-semibold shadow-sm text-lg"
                                style={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                    borderColor: theme.border,
                                    color: theme.text,
                                    '--tw-ring-color': theme.primary
                                } as any}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="text-red-500 text-sm font-semibold bg-red-100 p-3 rounded-xl border border-red-200">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSaving || !name.trim()}
                        className="w-full flex items-center justify-center gap-2 rounded-2xl py-4 mt-2 text-xl font-bold shadow-md hover:shadow-lg active:scale-[0.98] transition-all border disabled:opacity-70 disabled:filter-grayscale"
                        style={{ backgroundColor: theme.primary, color: getContrastColor(theme.primary), borderColor: theme.border }}
                    >
                        {isSaving ? (
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                            >
                                <RefreshCw size={24} />
                            </motion.div>
                        ) : (
                            <>
                                <UserCheck size={24} />
                                Save & Enter
                            </>
                        )}
                    </button>
                </form>
            </motion.div>

            <ImageEditorModal
                isOpen={editorOpen}
                onClose={() => setEditorOpen(false)}
                imageFile={rawSelectedImage}
                onSave={handleEditorSave}
                aspectRatio={1}
            />
        </motion.div>
    );
}
