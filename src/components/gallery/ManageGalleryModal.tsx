import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Loader2, Image as ImageIcon, Edit2, RefreshCw } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { db, storage } from '../../lib/firebase';
import { collection, query, where, doc, deleteDoc, onSnapshot, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { compressImage } from '../../utils/imageCompression';
import ImageEditorModal from '../ImageEditorModal';

interface ManageGalleryModalProps {
    isOpen: boolean;
    onClose: () => void;
    roomId: string;
}

const TOTAL_SLOTS = 12;

interface FrameSlot {
    index: number;
    file: File | null;
    previewUrl: string | null;
    title: string;
    uploading: boolean;
    uploadedUrl: string | null;
    firestoreId: string | null;
    deleting?: boolean; // New state for delete loading
}

export default function ManageGalleryModal({ isOpen, onClose, roomId }: ManageGalleryModalProps) {
    const { theme } = useAppContext();
    const { user } = useAuth();

    const [frames, setFrames] = useState<FrameSlot[]>(
        Array.from({ length: TOTAL_SLOTS }, (_, i) => ({
            index: i, file: null, previewUrl: null, title: '', uploading: false, uploadedUrl: null, firestoreId: null
        }))
    );

    const [loading, setLoading] = useState(true);
    const [activeFrameIndex, setActiveFrameIndex] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Image Editor State
    const [editorOpen, setEditorOpen] = useState(false);
    const [rawSelectedImage, setRawSelectedImage] = useState<File | null>(null);
    const [editorImageUrl, setEditorImageUrl] = useState<string | null>(null);

    // Sync from Firestore for this room
    useEffect(() => {
        if (!isOpen || !user || !roomId) return;

        setLoading(true);
        const q = query(collection(db, 'artworks'), where('roomId', '==', roomId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedDocs = snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                title: docSnap.data().title || '',
                imageUrl: docSnap.data().imageUrl,
                frameIndex: docSnap.data().frameIndex,
            }));

            setFrames(prev => {
                const newFrames = [...prev];
                // Reset all slots first, preserving only ongoing local uploads/deletions if necessary
                // For simplicity we just map them from the DB
                for (let i = 0; i < TOTAL_SLOTS; i++) {
                    const existingDoc = fetchedDocs.find(d => d.frameIndex === i);
                    if (existingDoc) {
                        newFrames[i] = {
                            ...newFrames[i],
                            previewUrl: existingDoc.imageUrl,
                            uploadedUrl: existingDoc.imageUrl,
                            title: existingDoc.title,
                            firestoreId: existingDoc.id,
                            uploading: false,
                            deleting: false,
                        };
                    } else if (newFrames[i].firestoreId && !existingDoc) {
                        // Document was deleted externally (e.g., successful delete logic below)
                        newFrames[i] = {
                            index: i, file: null, previewUrl: null, title: '', uploading: false, uploadedUrl: null, firestoreId: null
                        };
                    }
                    // If it's currently uploading locally (doesn't have firestoreId yet but has file/uploading flag), keep it as is
                }
                return newFrames;
            });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isOpen, user, roomId]);

    if (!isOpen) return null;

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && activeFrameIndex !== null) {
            setRawSelectedImage(e.target.files[0]);
            setEditorImageUrl(null);
            setEditorOpen(true);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleEditorSave = async (croppedFile: File) => {
        setEditorOpen(false);
        setRawSelectedImage(null);
        setEditorImageUrl(null);
        if (activeFrameIndex !== null) {
            const frame = frames[activeFrameIndex];
            const nameWithoutExt = croppedFile.name.replace(/\.[^/.]+$/, "");
            const titleToUse = frame.title || nameWithoutExt;

            setFrames(prev => prev.map(f =>
                f.index === activeFrameIndex
                    ? { ...f, file: croppedFile, previewUrl: URL.createObjectURL(croppedFile), title: titleToUse }
                    : f
            ));

            await uploadFrame(activeFrameIndex, croppedFile, titleToUse, frame.firestoreId);
        }
    };

    const uploadFrame = async (frameIndex: number, file: File, title: string, existingId?: string | null) => {
        if (!roomId || !user) return;

        setFrames(prev => prev.map(f => f.index === frameIndex ? { ...f, uploading: true } : f));

        try {
            const compressedFile = await compressImage(file, 1920, 0.8);
            const formData = new FormData();
            formData.append('file', compressedFile);
            formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET!);

            const cloudinaryReq = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`, {
                method: 'POST',
                body: formData,
            });

            if (!cloudinaryReq.ok) throw new Error("Cloudinary upload failed");
            const cloudinaryRes = await cloudinaryReq.json();
            const downloadUrl = cloudinaryRes.secure_url;

            if (existingId) {
                // Delete old from Firebase Storage if it exists
                const frame = frames.find(f => f.index === frameIndex);
                if (frame && frame.uploadedUrl && frame.uploadedUrl.includes('firebasestorage.googleapis.com')) {
                    const imageRef = ref(storage, frame.uploadedUrl);
                    try {
                        await deleteObject(imageRef);
                    } catch (e) {
                        console.error("Storage delete error:", e);
                    }
                }

                await updateDoc(doc(db, 'artworks', existingId), {
                    imageUrl: downloadUrl,
                    title: title
                });

                setFrames(prev => prev.map(f =>
                    f.index === frameIndex
                        ? { ...f, uploading: false, uploadedUrl: downloadUrl }
                        : f
                ));
            } else {
                const docRef = await addDoc(collection(db, 'artworks'), {
                    userId: user.uid,
                    roomId: roomId,
                    frameIndex: frameIndex,
                    title: title,
                    imageUrl: downloadUrl,
                    likesCount: 0,
                    commentsCount: 0,
                    createdAt: serverTimestamp()
                });

                // State will automatically be updated by onSnapshot, but we can optimistically update
                setFrames(prev => prev.map(f =>
                    f.index === frameIndex
                        ? { ...f, uploading: false, uploadedUrl: downloadUrl, firestoreId: docRef.id }
                        : f
                ));
            }

        } catch (error) {
            console.error("Frame upload error:", error);
            setFrames(prev => prev.map(f => f.index === frameIndex ? { ...f, uploading: false, previewUrl: null, file: null } : f));
            alert("Failed to upload artwork for this frame.");
        }
    };

    const handleEdit = (frameIndex: number, e: React.MouseEvent) => {
        e.stopPropagation();
        const frame = frames[frameIndex];
        if (!frame.previewUrl) return;
        setActiveFrameIndex(frameIndex);
        setEditorImageUrl(frame.previewUrl);
        setRawSelectedImage(null);
        setEditorOpen(true);
    };

    const handleChange = (frameIndex: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (frames[frameIndex].uploading || frames[frameIndex].deleting) return;
        setActiveFrameIndex(frameIndex);
        fileInputRef.current?.click();
    };

    const handleTitleChange = async (frameIndex: number, newTitle: string) => {
        setFrames(prev => prev.map(f => f.index === frameIndex ? { ...f, title: newTitle } : f));

        const frame = frames[frameIndex];
        if (frame.firestoreId) {
            try {
                await updateDoc(doc(db, 'artworks', frame.firestoreId), { title: newTitle });
            } catch (e) { console.error(e); }
        }
    };

    const handleDelete = async (frameIndex: number, e: React.MouseEvent) => {
        e.stopPropagation(); // Don't trigger the file upload
        const frame = frames[frameIndex];
        if (!frame.firestoreId || !frame.uploadedUrl) return;

        if (!confirm("Remove this artwork from the gallery?")) return;

        setFrames(prev => prev.map(f => f.index === frameIndex ? { ...f, deleting: true } : f));

        try {
            await deleteDoc(doc(db, 'artworks', frame.firestoreId));

            if (frame.uploadedUrl.includes('firebasestorage.googleapis.com')) {
                const imageRef = ref(storage, frame.uploadedUrl);
                try {
                    await deleteObject(imageRef);
                } catch (imgError) {
                    console.error("Storage delete error:", imgError);
                }
            }

            // Revert state to empty slot
            setFrames(prev => prev.map(f =>
                f.index === frameIndex
                    ? { index: frameIndex, file: null, previewUrl: null, title: '', uploading: false, uploadedUrl: null, firestoreId: null, deleting: false }
                    : f
            ));
        } catch (error) {
            console.error("Error deleting artwork:", error);
            setFrames(prev => prev.map(f => f.index === frameIndex ? { ...f, deleting: false } : f));
            alert("Failed to delete artwork.");
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            >
                <div
                    className="absolute inset-0 transition-colors duration-500 backdrop-blur-md bg-black/60"
                    onClick={onClose}
                />

                <motion.div
                    className="w-full max-w-6xl max-h-full h-full flex flex-col rounded-[2xl] p-4 md:p-8 relative z-10 border shadow-2xl overflow-hidden"
                    initial={{ scale: 0.95, y: 30, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.95, y: 30, opacity: 0 }}
                    transition={{ type: "spring", bounce: 0.2 }}
                    style={{
                        backgroundColor: theme.surface,
                        borderColor: theme.border,
                        color: theme.text,
                        borderRadius: '2rem'
                    }}
                >
                    <div className="flex justify-between items-center mb-6 px-2">
                        <div>
                            <h2 className="text-3xl font-black tracking-tight mb-1">Edit Exhibition Room</h2>
                            <p className="font-semibold opacity-60">Manage the 12 artworks on display in this room. Changes are saved automatically.</p>
                        </div>
                        <button onClick={onClose} className="p-3 bg-black/5 hover:bg-black/10 rounded-full transition-colors flex-shrink-0">
                            <X size={24} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-2 pb-6 custom-scrollbar">
                        {loading ? (
                            <div className="flex justify-center items-center h-64">
                                <Loader2 className="animate-spin text-primary" size={48} style={{ color: theme.primary }} />
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                {frames.map((frame, i) => (
                                    <div key={i} className="flex flex-col gap-2">
                                        <div
                                            onClick={() => {
                                                if (frame.uploading || frame.deleting || frame.firestoreId) return; // Only allow upload click if empty
                                                setActiveFrameIndex(i);
                                                fileInputRef.current?.click();
                                            }}
                                            className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center relative overflow-hidden transition-all group ${frame.previewUrl ? 'border-transparent shadow-md' : 'border-dashed border-gray-300 hover:border-[#fcaab8] cursor-pointer hover:bg-red-50/30'}`}
                                            style={{ backgroundColor: frame.previewUrl ? 'transparent' : 'rgba(0,0,0,0.02)' }}
                                        >
                                            {frame.previewUrl ? (
                                                <>
                                                    <img src={frame.previewUrl} alt={`Frame ${i + 1}`} className="w-full h-full object-cover" />

                                                    {frame.uploading && (
                                                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                                                            <Loader2 className="animate-spin text-[#fcaab8]" size={32} />
                                                        </div>
                                                    )}

                                                    {frame.deleting && (
                                                        <div className="absolute inset-0 bg-red-500/60 backdrop-blur-sm flex items-center justify-center">
                                                            <Loader2 className="animate-spin text-white" size={32} />
                                                        </div>
                                                    )}

                                                    {/* Action Buttons Hover Overlay */}
                                                    {!frame.uploading && !frame.deleting && frame.firestoreId && (
                                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-sm p-2 flex-wrap">
                                                            <button
                                                                onClick={(e) => handleEdit(i, e)}
                                                                className="bg-white/20 hover:bg-white/30 text-white p-2.5 rounded-full shadow-lg transition-transform hover:scale-105"
                                                                title="Edit / Crop"
                                                            >
                                                                <Edit2 size={20} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => handleChange(i, e)}
                                                                className="bg-white/20 hover:bg-white/30 text-white p-2.5 rounded-full shadow-lg transition-transform hover:scale-105"
                                                                title="Change Image"
                                                            >
                                                                <RefreshCw size={20} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => handleDelete(i, e)}
                                                                className="bg-red-500 hover:bg-red-600 text-white p-2.5 rounded-full flex items-center gap-2 font-bold shadow-lg transition-transform hover:scale-105"
                                                                title="Remove"
                                                            >
                                                                <Trash2 size={20} />
                                                                <span className="hidden sm:inline">Remove</span>
                                                            </button>
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="flex flex-col items-center opacity-40 text-gray-500 group-hover:opacity-100 group-hover:text-[#fcaab8] transition-colors">
                                                    <ImageIcon size={32} className="mb-2" />
                                                    <span className="font-bold text-sm">Add to Frame {i + 1}</span>
                                                </div>
                                            )}
                                        </div>

                                        {frame.previewUrl && (
                                            <input
                                                type="text"
                                                value={frame.title}
                                                onChange={(e) => handleTitleChange(i, e.target.value)}
                                                placeholder="Artwork Title"
                                                disabled={frame.uploading || frame.deleting}
                                                className="text-sm font-semibold bg-black/5 border-none rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-[#fcaab8]/50 outline-none w-full transition-shadow disabled:opacity-50"
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            accept="image/*"
                            className="hidden"
                        />
                    </div>
                </motion.div>
            </motion.div>

            <ImageEditorModal
                isOpen={editorOpen}
                onClose={() => { setEditorOpen(false); setRawSelectedImage(null); setEditorImageUrl(null); }}
                imageFile={rawSelectedImage}
                imageUrl={editorImageUrl}
                onSave={handleEditorSave}
                aspectRatio={1}
            />
        </AnimatePresence>
    );
}
