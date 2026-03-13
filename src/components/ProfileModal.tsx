import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, X, Save, Upload, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { compressImage } from '../utils/imageCompression';
import { useAppContext } from '../context/AppContext';
import { getContrastColor } from '../utils/colorUtils';
import ImageEditorModal from './ImageEditorModal';

const AVATAR_SEEDS = [
    'Felix', 'Aneka', 'Oliver', 'Mimi', 'Lola',
    'Jack', 'Buster', 'Jasper', 'Garfield', 'Cleo'
];

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentName: string;
    currentUsername: string;
    currentAvatarUrl: string;
    currentBio?: string;
    currentArtStyles?: string[];
    onSave: (newName: string, newUsername: string, newAvatarUrl: string, newBio: string, newArtStyles: string[]) => Promise<void> | void;
}

const AVAILABLE_ART_STYLES = [
    'Baroque', 'Rococo', 'Neoclassical', 'Romantic', 'Realism',
    'Impressionism', 'Cubism', 'Expressionism', 'Abstract Expressionism',
    'Dada', 'Surrealism', 'Anime', 'Digital', 'Minimalism', 'Pop Art'
];

export default function ProfileModal({ isOpen, onClose, currentName, currentUsername, currentAvatarUrl, currentBio = '', currentArtStyles = [], onSave }: ProfileModalProps) {
    const { user, profile } = useAuth();
    const { theme } = useAppContext();
    const [name, setName] = useState(currentName);
    const [username, setUsername] = useState(currentUsername);
    const [bio, setBio] = useState(currentBio);
    const [artStyles, setArtStyles] = useState<string[]>(currentArtStyles);
    const [seedIndex, setSeedIndex] = useState(0);
    const [customAvatar, setCustomAvatar] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState(currentAvatarUrl);
    const [isUploading, setIsUploading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [editorOpen, setEditorOpen] = useState(false);
    const [rawSelectedImage, setRawSelectedImage] = useState<File | null>(null);

    // Initial sync
    useEffect(() => {
        if (isOpen) {
            setName(currentName);
            setUsername(currentUsername);
            setBio(currentBio);
            setArtStyles(currentArtStyles);
            setPreviewUrl(currentAvatarUrl);
            setCustomAvatar(null);
            setErrorMsg(null);

            if (currentAvatarUrl.includes('dicebear')) {
                const currentSeed = currentAvatarUrl.split('seed=')[1]?.split('&')[0] || AVATAR_SEEDS[0];
                const idx = AVATAR_SEEDS.indexOf(currentSeed);
                setSeedIndex(idx !== -1 ? idx : 0);
            }
        }
    }, [isOpen, currentName, currentUsername, currentAvatarUrl]);

    // Calculate days since last username change
    const getDaysSinceLastChange = () => {
        if (!profile?.lastUsernameChange) return 999;
        const lastChangeDate = profile.lastUsernameChange.toDate ? profile.lastUsernameChange.toDate() : new Date(profile.lastUsernameChange);
        return (Date.now() - lastChangeDate.getTime()) / (1000 * 60 * 60 * 24);
    };

    const daysSinceChange = getDaysSinceLastChange();
    const canChangeUsername = daysSinceChange >= 3;
    const daysRemaining = Math.max(0, Math.ceil(3 - daysSinceChange));

    const handleNextAvatar = () => {
        const nextIdx = (seedIndex + 1) % AVATAR_SEEDS.length;
        setSeedIndex(nextIdx);
        setPreviewUrl(`https://api.dicebear.com/7.x/avataaars/svg?seed=${AVATAR_SEEDS[nextIdx]}`);
        setCustomAvatar(null);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setRawSelectedImage(file);
            setEditorOpen(true);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleEditorSave = (croppedFile: File) => {
        setCustomAvatar(croppedFile);
        setPreviewUrl(URL.createObjectURL(croppedFile));
        setEditorOpen(false);
    };

    const toggleArtStyle = (style: string) => {
        setArtStyles(prev =>
            prev.includes(style)
                ? prev.filter(s => s !== style)
                : [...prev, style]
        );
    };

    const handleSave = async () => {
        if (!name.trim()) return;

        setIsUploading(true);
        let finalAvatarUrl = previewUrl;

        try {
            if (customAvatar && user) {
                const compressedAvatar = await compressImage(customAvatar, 500, 0.8);

                const formData = new FormData();
                formData.append('file', compressedAvatar);
                formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);

                const cloudinaryReq = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`, {
                    method: 'POST',
                    body: formData,
                });

                if (!cloudinaryReq.ok) {
                    throw new Error("Failed to upload image to Cloudinary");
                }

                const cloudinaryRes = await cloudinaryReq.json();
                finalAvatarUrl = cloudinaryRes.secure_url;
            }

            await onSave(name, username.trim(), finalAvatarUrl, bio, artStyles);
            onClose();
        } catch (error: any) {
            console.error("Failed to save profile", error);
            setErrorMsg(error.message || "Failed to save profile.");
        } finally {
            setIsUploading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            >
                {/* Backdrop */}
                <div
                    className="absolute inset-0 backdrop-blur-sm cursor-pointer"
                    style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
                    onClick={() => !isUploading && onClose()}
                />

                {/* Modal Content */}
                <motion.div
                    className="w-full max-w-lg rounded-[2.5rem] p-8 backdrop-blur-xl border shadow-2xl relative z-10 max-h-[90vh] overflow-y-auto custom-scrollbar"
                    initial={{ scale: 0.9, y: 20, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.9, y: 20, opacity: 0 }}
                    transition={{ type: "spring", bounce: 0.4 }}
                    style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                >
                    <button
                        onClick={onClose}
                        disabled={isUploading}
                        className="absolute right-6 top-6 transition-colors p-2 rounded-full disabled:opacity-50"
                        style={{ color: theme.text, opacity: 0.5 }}
                        onMouseEnter={(e) => e.currentTarget.style.color = theme.primary}
                        onMouseLeave={(e) => { e.currentTarget.style.color = theme.text; e.currentTarget.style.opacity = '0.5'; }}
                    >
                        <X size={24} />
                    </button>

                    <h3 className="text-2xl font-bold mb-6 tracking-tight text-center mt-2" style={{ color: theme.text }}>Edit Profile</h3>

                    <div className="flex flex-col items-center gap-6">
                        {/* Avatar */}
                        <div className="flex flex-col items-center gap-3">
                            <div className="relative group cursor-pointer" onClick={handleNextAvatar}>
                                <motion.div
                                    className="w-28 h-28 rounded-full overflow-hidden shadow-md outline outline-4 p-1 relative"
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    style={{ outlineColor: theme.border, backgroundColor: theme.primary }}
                                >
                                    <img src={previewUrl} alt="Preview Avatar" className="w-full h-full object-cover rounded-full" />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                </motion.div>

                                <div
                                    className="absolute bottom-0 right-0 w-8 h-8 rounded-full shadow-md flex items-center justify-center border group-hover:scale-110 transition-transform"
                                    style={{ backgroundColor: theme.surface, color: theme.primary, borderColor: theme.border }}
                                >
                                    <RefreshCw size={16} strokeWidth={3} />
                                </div>
                            </div>

                            {/* Upload Button */}
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-2 text-sm font-bold transition-colors px-4 py-1.5 rounded-full shadow-sm hover:brightness-110"
                                style={{ backgroundColor: theme.surface, color: theme.text }}
                            >
                                <Upload size={14} /> Upload Photo
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                accept="image/*"
                                className="hidden"
                            />
                        </div>

                        {/* Name Input */}
                        <div className="w-full space-y-2">
                            <label className="text-sm font-bold ml-2" style={{ color: theme.text, opacity: 0.8 }}>Display Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                maxLength={30}
                                disabled={isUploading}
                                className="w-full rounded-2xl border px-5 py-3 focus:outline-none focus:ring-4 transition-all font-sans font-semibold shadow-sm disabled:opacity-50"
                                style={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                    borderColor: theme.border,
                                    color: theme.text,
                                    '--tw-ring-color': theme.primary
                                } as any}
                            />
                        </div>

                        {/* Username Input */}
                        <div className="w-full space-y-2">
                            <div className="flex justify-between items-center ml-2">
                                <label className="text-sm font-bold" style={{ color: theme.text, opacity: 0.8 }}>Username</label>
                                {!canChangeUsername && (
                                    <span className="text-xs font-semibold text-orange-500">
                                        Can change in {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}
                                    </span>
                                )}
                            </div>
                            <div className="relative flex items-center">
                                <span className="absolute left-4 font-bold" style={{ color: theme.text, opacity: 0.5 }}>@</span>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
                                    maxLength={20}
                                    disabled={isUploading || !canChangeUsername}
                                    className="w-full rounded-2xl border py-3 pl-10 pr-5 focus:outline-none focus:ring-4 transition-all font-sans font-semibold shadow-sm disabled:opacity-50"
                                    style={{
                                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                        borderColor: theme.border,
                                        color: theme.text,
                                        '--tw-ring-color': theme.primary
                                    } as any}
                                />
                            </div>
                        </div>

                        {/* Bio Input */}
                        <div className="w-full space-y-2">
                            <label className="text-sm font-bold ml-2" style={{ color: theme.text, opacity: 0.8 }}>Bio</label>
                            <textarea
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                maxLength={160}
                                disabled={isUploading}
                                placeholder="Tell us about your art..."
                                className="w-full rounded-2xl border px-5 py-3 focus:outline-none focus:ring-4 transition-all font-sans font-semibold shadow-sm disabled:opacity-50 resize-none h-24"
                                style={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                    borderColor: theme.border,
                                    color: theme.text,
                                    '--tw-ring-color': theme.primary
                                } as any}
                            />
                        </div>

                        {/* Art Styles Selection */}
                        <div className="w-full space-y-3">
                            <label className="text-sm font-bold ml-2" style={{ color: theme.text, opacity: 0.8 }}>Art Styles</label>
                            <div className="flex flex-wrap gap-2">
                                {AVAILABLE_ART_STYLES.map(style => {
                                    const isSelected = artStyles.includes(style);
                                    return (
                                        <button
                                            key={style}
                                            onClick={() => toggleArtStyle(style)}
                                            disabled={isUploading}
                                            className="px-3 py-1.5 rounded-full text-xs font-bold transition-all border hover:brightness-110"
                                            style={{
                                                backgroundColor: isSelected ? theme.primary : theme.surface,
                                                borderColor: isSelected ? theme.primary : theme.border,
                                                color: isSelected ? getContrastColor(theme.primary) : theme.text,
                                                opacity: isSelected ? 1 : 0.6
                                            }}
                                        >
                                            {style}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {errorMsg && (
                            <div className="w-full bg-red-100 border border-red-300 text-red-600 px-4 py-3 rounded-xl text-sm font-semibold">
                                {errorMsg}
                            </div>
                        )}

                        {/* Actions */}
                        <button
                            onClick={handleSave}
                            disabled={!name.trim() || !username.trim() || isUploading}
                            className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 mt-2 text-lg font-bold shadow-md hover:shadow-lg active:scale-[0.98] transition-all border disabled:opacity-50"
                            style={{ backgroundColor: theme.primary, borderColor: theme.border, color: getContrastColor(theme.primary) }}
                        >
                            {isUploading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                            {isUploading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </motion.div>
            </motion.div>

            <ImageEditorModal
                isOpen={editorOpen}
                onClose={() => setEditorOpen(false)}
                imageFile={rawSelectedImage}
                onSave={handleEditorSave}
                aspectRatio={1} // 1:1 for Avatars
            />
        </AnimatePresence>
    );
}
