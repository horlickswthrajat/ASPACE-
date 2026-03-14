import React, { useState, useRef } from 'react';
import { motion, type Variants } from 'framer-motion';
import { Loader2, ArrowRight, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { compressImage } from '../../utils/imageCompression';
import { getContrastColor } from '../../utils/colorUtils';
import ImageEditorModal from '../ImageEditorModal';
import { getCloudinaryConfig } from '../../utils/cloudinaryUtils';

interface CreateRoomWizardProps {
    containerVariants: Variants;
    itemVariants: Variants;
}

// Fixed 12 slots for the gallery
const TOTAL_SLOTS = 12;

interface FrameSlot {
    index: number;
    file: File | null;
    previewUrl: string | null;
    title: string;
    description: string;
    uploading: boolean;
    uploadedUrl: string | null;
    firestoreId: string | null;
}

export default function CreateRoomWizard({ containerVariants }: CreateRoomWizardProps) {
    const { theme } = useAppContext();
    const { user } = useAuth();

    // Step 1: Room Info
    const [step, setStep] = useState<1 | 2>(1);
    const [roomName, setRoomName] = useState('');
    const [roomDescription, setRoomDescription] = useState('');
    const [roomType] = useState<'atrium' | 'classical_salon' | 'industrial_warehouse' | 'neon_void'>('atrium');
    const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
    const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
    const [creatingRoom, setCreatingRoom] = useState(false);
    const [roomId, setRoomId] = useState<string | null>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);

    // Step 2: Frames
    const [frames, setFrames] = useState<FrameSlot[]>(
        Array.from({ length: TOTAL_SLOTS }, (_, i) => ({
            index: i, file: null, previewUrl: null, title: '', description: '', uploading: false, uploadedUrl: null, firestoreId: null
        }))
    );
    const [activeFrameIndex, setActiveFrameIndex] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Image Editor State
    const [editorOpen, setEditorOpen] = useState(false);
    const [editorTarget, setEditorTarget] = useState<'cover' | 'frame'>('cover');
    const [rawSelectedImage, setRawSelectedImage] = useState<File | null>(null);

    const handleCreateRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !roomName.trim()) return;

        setCreatingRoom(true);
        try {
            let coverImageUrl = null;

            // Upload cover image if selected
            if (coverImageFile) {
                const config = getCloudinaryConfig();
                const compressedFile = await compressImage(coverImageFile, 1200, 0.8);
                const formData = new FormData();
                formData.append('file', compressedFile);
                formData.append('upload_preset', config.uploadPreset);

                const cloudinaryReq = await fetch(config.uploadUrl, {
                    method: 'POST',
                    body: formData,
                });

                if (cloudinaryReq.ok) {
                    const cloudinaryRes = await cloudinaryReq.json();
                    coverImageUrl = cloudinaryRes.secure_url;
                }
            }

            const docRef = await addDoc(collection(db, 'rooms'), {
                userId: user.uid,
                name: roomName.trim(),
                description: roomDescription.trim(),
                roomType: roomType,
                imageUrl: coverImageUrl,
                ratingSum: 0,
                ratingCount: 0,
                createdAt: serverTimestamp()
            });
            setRoomId(docRef.id);
            setStep(2);
        } catch (error) {
            console.error("Error creating room:", error);
            alert("Failed to create room.");
        } finally {
            setCreatingRoom(false);
        }
    };

    const handleCoverImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setRawSelectedImage(e.target.files[0]);
            setEditorTarget('cover');
            setEditorOpen(true);
        }
        if (coverInputRef.current) coverInputRef.current.value = '';
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && activeFrameIndex !== null) {
            setRawSelectedImage(e.target.files[0]);
            setEditorTarget('frame');
            setEditorOpen(true);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleEditorSave = async (croppedFile: File) => {
        setEditorOpen(false);

        if (editorTarget === 'cover') {
            setCoverImageFile(croppedFile);
            setCoverImagePreview(URL.createObjectURL(croppedFile));
        } else if (editorTarget === 'frame' && activeFrameIndex !== null) {
            const currentFrame = frames.find(f => f.index === activeFrameIndex);
            const currentTitle = currentFrame?.title || '';
            const currentDesc = currentFrame?.description || '';

            setFrames(prev => prev.map(f =>
                f.index === activeFrameIndex
                    ? { ...f, file: croppedFile, previewUrl: URL.createObjectURL(croppedFile), title: currentTitle }
                    : f
            ));

            // Auto trigger upload with cropped file
            await uploadFrame(activeFrameIndex, croppedFile, currentTitle, currentDesc);
        }
    };

    const uploadFrame = async (frameIndex: number, file: File, title: string, description: string) => {
        if (!roomId || !user) return;

        // Mark as uploading
        setFrames(prev => prev.map(f => f.index === frameIndex ? { ...f, uploading: true } : f));

        try {
            const config = getCloudinaryConfig();
            const compressedFile = await compressImage(file, 1920, 0.8);
            const formData = new FormData();
            formData.append('file', compressedFile);
            formData.append('upload_preset', config.uploadPreset);

            const cloudinaryReq = await fetch(config.uploadUrl, {
                method: 'POST',
                body: formData,
            });

            if (!cloudinaryReq.ok) throw new Error("Cloudinary upload failed");
            const cloudinaryRes = await cloudinaryReq.json();
            const downloadUrl = cloudinaryRes.secure_url;

            // Save to Firestore
            const docRef = await addDoc(collection(db, 'artworks'), {
                userId: user.uid,
                roomId: roomId,
                frameIndex: frameIndex,
                title: title,
                description: description,
                imageUrl: downloadUrl,
                likesCount: 0,
                commentsCount: 0,
                createdAt: serverTimestamp()
            });

            // Mark as done
            setFrames(prev => prev.map(f =>
                f.index === frameIndex
                    ? { ...f, uploading: false, uploadedUrl: downloadUrl, firestoreId: docRef.id }
                    : f
            ));

        } catch (error) {
            console.error("Frame upload error:", error);
            setFrames(prev => prev.map(f => f.index === frameIndex ? { ...f, uploading: false } : f));
            alert("Failed to upload artwork for this frame.");
        }
    };

    const handleTitleChange = async (frameIndex: number, newTitle: string) => {
        setFrames(prev => prev.map(f => f.index === frameIndex ? { ...f, title: newTitle } : f));

        // Optimistically update firestore if it's already uploaded
        const frame = frames[frameIndex];
        if (frame.firestoreId) {
            try {
                await updateDoc(doc(db, 'artworks', frame.firestoreId), { title: newTitle });
            } catch (e) { console.error(e); }
        }
    };

    const handleDescriptionChange = async (frameIndex: number, newDescription: string) => {
        setFrames(prev => prev.map(f => f.index === frameIndex ? { ...f, description: newDescription } : f));

        // Optimistically update firestore if it's already uploaded
        const frame = frames[frameIndex];
        if (frame.firestoreId) {
            try {
                await updateDoc(doc(db, 'artworks', frame.firestoreId), { description: newDescription });
            } catch (e) { console.error(e); }
        }
    };


    return (
        <motion.div
            className="flex-1 flex flex-col overflow-hidden m-0 md:mr-4 md:my-4 rounded-none md:rounded-[2.5rem] shadow-sm border-0 md:border"
            variants={containerVariants}
            initial="hidden"
            animate="show"
            style={{ backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }}
        >
            {/* Header progress */}
            <div className="p-4 md:p-8 border-b" style={{ borderColor: theme.border }}>
                <div className="flex items-center gap-2 md:gap-4 overflow-x-auto hide-scrollbar">
                    <div className="w-6 h-6 md:w-8 md:h-8 flex-shrink-0 flex items-center justify-center rounded-full font-bold text-xs md:text-base transition-colors" style={{ backgroundColor: step === 1 ? theme.primary : theme.border, color: step === 1 ? getContrastColor(theme.primary) : theme.text }}>1</div>
                    <h2 className="font-bold text-sm md:text-base whitespace-nowrap transition-opacity" style={{ color: theme.text, opacity: step === 1 ? 1 : 0.5 }}>Room Details</h2>
                    <div className="w-8 md:w-12 h-0.5 md:h-1 rounded-full mx-1 md:mx-2 transition-colors flex-shrink-0" style={{ backgroundColor: theme.border }} />
                    <div className="w-6 h-6 md:w-8 md:h-8 flex-shrink-0 flex items-center justify-center rounded-full font-bold text-xs md:text-base transition-colors" style={{ backgroundColor: step === 2 ? theme.primary : theme.border, color: step === 2 ? getContrastColor(theme.primary) : theme.text }}>2</div>
                    <h2 className="font-bold text-sm md:text-base whitespace-nowrap transition-opacity" style={{ color: theme.text, opacity: step === 2 ? 1 : 0.5 }}>Place Artworks</h2>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-12">
                {step === 1 && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl mx-auto py-4 md:py-0">
                        <h1 className="text-2xl md:text-4xl font-black mb-2 tracking-tight" style={{ color: theme.text }}>Create a New Room</h1>
                        <p className="font-semibold mb-6 md:mb-8 text-sm md:text-base" style={{ color: theme.text, opacity: 0.6 }}>Design a unique 3D space to showcase your collection.</p>

                        <form onSubmit={handleCreateRoom} className="flex flex-col gap-6">

                            {/* Room Cover Image Upload */}
                            <div>
                                <label className="block text-sm font-bold mb-2 ml-2" style={{ color: theme.text, opacity: 0.8 }}>Cover Image (Optional)</label>
                                <div
                                    onClick={() => coverInputRef.current?.click()}
                                    className={`w-full h-48 rounded-2xl border-2 flex items-center justify-center relative overflow-hidden transition-all cursor-pointer ${coverImagePreview ? 'shadow-sm' : 'border-dashed'}`}
                                    style={{ borderColor: coverImagePreview ? 'transparent' : theme.border, backgroundColor: 'rgba(0,0,0,0.02)' }}
                                >
                                    {coverImagePreview ? (
                                        <>
                                            <img src={coverImagePreview} alt="Cover Preview" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <span className="text-white font-bold bg-black/50 px-4 py-2 rounded-full backdrop-blur-md">Change Cover</span>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center opacity-50 transition-colors" style={{ color: theme.text }}>
                                            <ImageIcon size={32} className="mb-2" />
                                            <span className="font-bold text-sm">Upload Cover Image</span>
                                        </div>
                                    )}
                                </div>
                                <input
                                    type="file"
                                    ref={coverInputRef}
                                    onChange={handleCoverImageSelect}
                                    accept="image/*"
                                    className="hidden"
                                />
                            </div>


                            <div>
                                <label className="block text-sm font-bold mb-2 ml-2" style={{ color: theme.text, opacity: 0.8 }}>Room Name</label>
                                <input
                                    type="text"
                                    value={roomName}
                                    onChange={(e) => setRoomName(e.target.value)}
                                    placeholder="e.g. Summer Collection '24"
                                    required
                                    className="w-full border rounded-2xl py-4 px-6 focus:outline-none focus:ring-4 font-semibold shadow-sm transition-all"
                                    style={{
                                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                        borderColor: theme.border,
                                        color: theme.text,
                                        '--tw-ring-color': theme.primary
                                    } as any}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-2 ml-2" style={{ color: theme.text, opacity: 0.8 }}>Description</label>
                                <textarea
                                    value={roomDescription}
                                    onChange={(e) => setRoomDescription(e.target.value)}
                                    placeholder="What inspired this collection?"
                                    className="w-full h-32 border rounded-2xl py-4 px-6 focus:outline-none focus:ring-4 font-semibold resize-none shadow-sm transition-all"
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
                                disabled={!roomName.trim() || creatingRoom}
                                className="w-full py-4 rounded-[1.5rem] font-bold text-lg shadow-xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2 mt-4"
                                style={{ backgroundColor: theme.primary, color: getContrastColor(theme.primary) }}
                            >
                                {creatingRoom ? <Loader2 className="animate-spin" /> : 'Create Empty Room'}
                                {!creatingRoom && <ArrowRight size={20} />}
                            </button>
                        </form>
                    </motion.div>
                )}

                {step === 2 && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
                            <div>
                                <h1 className="text-2xl md:text-3xl font-black mb-1" style={{ color: theme.text }}>{roomName}</h1>
                                <p className="font-semibold text-sm md:text-base opacity-60" style={{ color: theme.text }}>Click a frame slot to upload an artwork (Max 12).</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {frames.map((frame, i) => (
                                <div key={i} className="flex flex-col gap-2">
                                    <div
                                        onClick={() => {
                                            if (frame.uploading) return;
                                            setActiveFrameIndex(i);
                                            fileInputRef.current?.click();
                                        }}
                                        className={`aspect-square rounded-2xl border-2 flex items-center justify-center relative overflow-hidden transition-all ${frame.previewUrl ? 'shadow-md' : 'border-dashed cursor-pointer'}`}
                                        style={{ borderColor: frame.previewUrl ? 'transparent' : theme.border, backgroundColor: 'rgba(0,0,0,0.02)' }}
                                    >
                                        {frame.previewUrl ? (
                                            <>
                                                <img src={frame.previewUrl} alt={`Frame ${i + 1}`} className="w-full h-full object-cover" />
                                                {frame.uploading && (
                                                    <div className="absolute inset-0 backdrop-blur-sm flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
                                                        <Loader2 className="animate-spin" size={32} style={{ color: theme.primary }} />
                                                    </div>
                                                )}
                                                {frame.uploadedUrl && !frame.uploading && (
                                                    <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1 shadow-md">
                                                        <CheckCircle2 size={16} />
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                                                    <span className="text-white font-bold bg-black/50 px-4 py-2 rounded-full backdrop-blur-md">Change</span>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center opacity-50 transition-colors" style={{ color: theme.text }}>
                                                <ImageIcon size={32} className="mb-2" />
                                                <span className="font-bold text-sm">Frame {i + 1}</span>
                                            </div>
                                        )}
                                    </div>
                                    {frame.previewUrl && (
                                        <div className="flex flex-col gap-2 w-full mt-2">
                                            <input
                                                type="text"
                                                value={frame.title}
                                                onChange={(e) => handleTitleChange(i, e.target.value)}
                                                placeholder="Artwork Name"
                                                className="text-sm font-bold border rounded-lg px-3 py-2 outline-none w-full shadow-sm"
                                                style={{
                                                    backgroundColor: theme.surface,
                                                    borderColor: theme.border,
                                                    color: theme.text,
                                                }}
                                            />
                                            <textarea
                                                value={frame.description}
                                                onChange={(e) => handleDescriptionChange(i, e.target.value)}
                                                placeholder="Artwork Description..."
                                                rows={2}
                                                className="text-xs font-semibold border rounded-lg px-3 py-2 outline-none w-full resize-none shadow-sm"
                                                style={{
                                                    backgroundColor: theme.surface,
                                                    borderColor: theme.border,
                                                    color: theme.text,
                                                    opacity: 0.9
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            accept="image/*"
                            className="hidden"
                        />

                        <div className="mt-12 flex justify-end">
                            <button
                                onClick={() => {
                                    // Could add a toast here
                                    window.location.reload(); // Temporary way to "finish" and reset to profile/dashboard
                                }}
                                className="px-8 py-4 rounded-[1.5rem] font-bold text-lg shadow-xl transition-all hover:scale-[1.02] active:scale-95"
                                style={{ backgroundColor: theme.primary, color: getContrastColor(theme.primary) }}
                            >
                                Finish Placement
                            </button>
                        </div>
                    </motion.div>
                )}
            </div>

            <ImageEditorModal
                isOpen={editorOpen}
                onClose={() => setEditorOpen(false)}
                imageFile={rawSelectedImage}
                onSave={handleEditorSave}
                aspectRatio={editorTarget === 'cover' ? 16 / 9 : 1}
            />
        </motion.div>
    );
}
