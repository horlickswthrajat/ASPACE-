import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Image as ImageIcon } from 'lucide-react';
import { compressImage } from '../utils/imageCompression';
import { db } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp, collection, query, where, getDocs, deleteDoc, addDoc } from 'firebase/firestore';
import { useAppContext } from '../context/AppContext';
import { getContrastColor } from '../utils/colorUtils';
import ImageEditorModal from './ImageEditorModal';
import { getCloudinaryConfig } from '../utils/cloudinaryUtils';

interface EditRoomModalProps {
    isOpen: boolean;
    onClose: () => void;
    room: {
        id: string;
        name: string;
        description: string;
        imageUrl?: string;
    } | null;
    onRoomUpdated: () => void;
}

export default function EditRoomModal({ isOpen, onClose, room, onRoomUpdated }: EditRoomModalProps) {
    const { theme } = useAppContext();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
    const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
    const [editorOpen, setEditorOpen] = useState(false);
    const [rawSelectedImage, setRawSelectedImage] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);

    // Artwork editing state
    const [artworks, setArtworks] = useState<any[]>([]);
    const [fetchingArtworks, setFetchingArtworks] = useState(false);
    const [editorTarget, setEditorTarget] = useState<'cover' | 'frame' | 'new_frame'>('cover');
    const [editorImageUrl, setEditorImageUrl] = useState<string | null>(null);
    const [editingArtworkId, setEditingArtworkId] = useState<string | null>(null);
    const [uploadingFrameId, setUploadingFrameId] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const pendingActionRef = useRef<{ target: 'cover' | 'frame' | 'new_frame'; artworkId?: string }>({ target: 'cover' });

    // Initialize state when room changes
    React.useEffect(() => {
        if (room) {
            setName(room.name);
            setDescription(room.description);
            setCoverImagePreview(room.imageUrl || null);
            setCoverImageFile(null); // Reset file on open
            fetchArtworks(room.id);
        }
    }, [room, isOpen]);

    const fetchArtworks = async (roomId: string) => {
        setFetchingArtworks(true);
        try {
            const q = query(collection(db, 'artworks'), where('roomId', '==', roomId));
            const snapshot = await getDocs(q);
            const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
            fetched.sort((a, b) => a.frameIndex - b.frameIndex);
            setArtworks(fetched);
        } catch (e) {
            console.error("Error fetching artworks", e);
        } finally {
            setFetchingArtworks(false);
        }
    };

    const triggerFileInput = (target: 'cover' | 'frame' | 'new_frame', artworkId?: string) => {
        pendingActionRef.current = { target, artworkId };
        fileInputRef.current?.click();
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { target, artworkId } = pendingActionRef.current;
        if (e.target.files && e.target.files[0]) {
            setRawSelectedImage(e.target.files[0]);
            setEditorImageUrl(null); // Clear URL when a new file is selected
            setEditorTarget(target);
            if (target === 'frame' && artworkId) {
                setEditingArtworkId(artworkId);
            }
            setEditorOpen(true);
        }
        // Reset input so the same file can be selected again if cropped differently
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleEditExistingCover = () => {
        if (coverImagePreview) {
            setRawSelectedImage(null);
            setEditorImageUrl(coverImagePreview);
            setEditorTarget('cover');
            setEditorOpen(true);
        }
    };

    const handleDeleteArtwork = async (artworkId: string, artworkTitle: string) => {
        if (!window.confirm(`Are you sure you want to delete the artwork "${artworkTitle || 'Untitled'}"?`)) {
            return;
        }
        try {
            await deleteDoc(doc(db, 'artworks', artworkId));
            setArtworks(prev => prev.filter(a => a.id !== artworkId));
            onRoomUpdated();
        } catch (error) {
            console.error("Error deleting artwork:", error);
            alert("Failed to delete artwork.");
        }
    };

    const handleEditorSave = async (croppedFile: File) => {
        setEditorOpen(false);
        if (editorTarget === 'cover') {
            setCoverImageFile(croppedFile);
            setCoverImagePreview(URL.createObjectURL(croppedFile));
        } else if ((editorTarget === 'frame' && editingArtworkId) || editorTarget === 'new_frame') {
            const isNew = editorTarget === 'new_frame';
            if (!isNew) setUploadingFrameId(editingArtworkId);

            try {
                const config = getCloudinaryConfig();
                const compressedFile = await compressImage(croppedFile, 1920, 0.8);
                const formData = new FormData();
                formData.append('file', compressedFile);
                formData.append('upload_preset', config.uploadPreset);

                const cloudinaryReq = await fetch(config.uploadUrl, {
                    method: 'POST',
                    body: formData,
                });

                if (cloudinaryReq.ok) {
                    const cloudinaryRes = await cloudinaryReq.json();
                    const newUrl = cloudinaryRes.secure_url;

                    if (isNew && room) {
                        // Create new artwork doc
                        const newArtwork = {
                            roomId: room.id,
                            userId: (room as any).userId || '',
                            imageUrl: newUrl,
                            title: 'New Artwork',
                            description: '',
                            frameIndex: artworks.length,
                            createdAt: serverTimestamp()
                        };
                        const artRef = await addDoc(collection(db, 'artworks'), newArtwork);
                        setArtworks(prev => [...prev, { id: artRef.id, ...newArtwork }]);
                        onRoomUpdated(); // fetch rooms to update layout size possibly
                    } else if (editingArtworkId) {
                        const artRef = doc(db, 'artworks', editingArtworkId);
                        await updateDoc(artRef, { imageUrl: newUrl });
                        setArtworks(prev => prev.map(a => a.id === editingArtworkId ? { ...a, imageUrl: newUrl } : a));
                    }
                }
            } catch (e) {
                console.error("Error updating frame", e);
                alert("Failed to update artwork");
            } finally {
                setUploadingFrameId(null);
            }
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!room || !name.trim()) return;

        setSaving(true);
        try {
            let coverImageUrl = room.imageUrl;

            // Upload new cover image if selected
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
                } else {
                    throw new Error("Failed to upload image.");
                }
            }

            // Update Firestore
            const roomRef = doc(db, 'rooms', room.id);
            await updateDoc(roomRef, {
                name: name.trim(),
                description: description.trim(),
                imageUrl: coverImageUrl,
                updatedAt: serverTimestamp()
            });

            onRoomUpdated();
            onClose();
        } catch (error) {
            console.error("Error updating room:", error);
            alert("Failed to update exhibition details.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && room && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border"
                        style={{ backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: theme.border }}>
                            <h2 className="text-2xl font-black tracking-tight" style={{ color: theme.text }}>Edit Exhibition</h2>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <X size={24} style={{ color: theme.text }} />
                            </button>
                        </div>

                        {/* Form Body */}
                        <div className="overflow-y-auto p-6 custom-scrollbar">
                            <form id="edit-room-form" onSubmit={handleSave} className="flex flex-col gap-6">
                                {/* Thumbnail Upload */}
                                <div>
                                    <label className="block text-sm font-bold mb-2 ml-2" style={{ color: theme.text, opacity: 0.8 }}>Cover Thumbnail</label>
                                    <div
                                        onClick={() => triggerFileInput('cover')}
                                        className={`w-full h-48 rounded-2xl border-2 flex items-center justify-center relative overflow-hidden transition-all cursor-pointer ${coverImagePreview ? 'border-transparent shadow-sm' : 'border-dashed border-gray-300 hover:border-[#fcaab8] hover:bg-red-50/30'}`}
                                    >
                                        {coverImagePreview ? (
                                            <>
                                                <img src={coverImagePreview} alt="Cover Preview" className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                    <span className="text-white font-bold bg-black/50 px-4 py-2 rounded-full backdrop-blur-md">Change Cover</span>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleEditExistingCover();
                                                        }}
                                                        className="text-white font-bold bg-[#fcaab8]/80 hover:bg-[#fcaab8] px-4 py-2 rounded-full backdrop-blur-md transition-colors shadow-lg"
                                                    >
                                                        Edit Cover
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center opacity-50 text-gray-500">
                                                <ImageIcon size={32} className="mb-2" />
                                                <span className="font-bold text-sm">Upload Thumbnail</span>
                                            </div>
                                        )}
                                    </div>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleImageSelect}
                                        accept="image/*"
                                        className="hidden"
                                    />
                                </div>

                                {/* Room Name */}
                                <div>
                                    <label className="block text-sm font-bold mb-2 ml-2" style={{ color: theme.text, opacity: 0.8 }}>Name</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                        className="w-full border rounded-2xl py-3 px-5 focus:outline-none focus:ring-4 font-semibold shadow-sm transition-all"
                                        style={{
                                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                            borderColor: theme.border,
                                            color: theme.text,
                                            '--tw-ring-color': theme.primary
                                        } as any}
                                    />
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-sm font-bold mb-2 ml-2" style={{ color: theme.text, opacity: 0.8 }}>Description</label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        rows={3}
                                        className="w-full border rounded-2xl py-3 px-5 focus:outline-none focus:ring-4 font-semibold resize-none shadow-sm transition-all"
                                        style={{
                                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                            borderColor: theme.border,
                                            color: theme.text,
                                            '--tw-ring-color': theme.primary
                                        } as any}
                                    />
                                </div>

                                {/* Artworks */}
                                <div>
                                    <label className="block text-sm font-bold mb-2 ml-2" style={{ color: theme.text, opacity: 0.8 }}>Artworks Layout</label>
                                    {fetchingArtworks ? (
                                        <div className="flex justify-center py-8 opacity-50">
                                            <Loader2 className="animate-spin" size={24} />
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                                            {artworks.map((art) => (
                                                <div
                                                    key={art.id}
                                                    className="aspect-square bg-gray-100 rounded-xl relative overflow-hidden group cursor-pointer border-2 border-transparent hover:border-[#fcaab8] transition-all shadow-sm"
                                                    onClick={() => triggerFileInput('frame', art.id)}
                                                >
                                                    <img src={art.imageUrl} alt={art.title} className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <span className="text-white text-xs font-bold leading-tight px-2 text-center drop-shadow-md">Change</span>
                                                    </div>

                                                    {/* Delete Artwork Button */}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteArtwork(art.id, art.title);
                                                        }}
                                                        className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-md transform hover:scale-110"
                                                        title="Remove artwork"
                                                    >
                                                        <X size={14} strokeWidth={3} />
                                                    </button>

                                                    {uploadingFrameId === art.id && (
                                                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                                                            <Loader2 className="animate-spin text-[#fcaab8]" size={24} />
                                                        </div>
                                                    )}
                                                </div>
                                            ))}

                                            {/* Add Artwork Button */}
                                            <div
                                                onClick={() => triggerFileInput('new_frame')}
                                                className="aspect-square rounded-xl border-2 border-dashed border-gray-300 hover:border-[#fcaab8] hover:bg-red-50/30 flex flex-col items-center justify-center cursor-pointer transition-all group"
                                            >
                                                <div className="w-10 h-10 rounded-full bg-gray-100 group-hover:bg-[#fcaab8]/20 flex items-center justify-center mb-2 transition-colors">
                                                    <span className="text-2xl font-black text-gray-400 group-hover:text-[#fcaab8] leading-none mb-1">+</span>
                                                </div>
                                                <span className="text-xs font-bold text-gray-500 group-hover:text-[#fcaab8] transition-colors">Add Artwork</span>
                                            </div>

                                        </div>
                                    )}
                                </div>
                            </form>
                        </div>

                        {/* Footer area */}
                        <div className="p-6 border-t" style={{ borderColor: theme.border, backgroundColor: 'rgba(0,0,0,0.05)' }}>
                            <div className="flex gap-4">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 py-3.5 rounded-2xl font-bold border hover:opacity-80 transition-opacity"
                                    style={{ borderColor: theme.border, color: theme.text }}
                                >
                                    Cancel
                                </button>
                                <button
                                    form="edit-room-form"
                                    type="submit"
                                    disabled={saving || !name.trim()}
                                    className="flex-1 py-3.5 rounded-2xl font-bold shadow-md transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
                                    style={{ backgroundColor: theme.primary, color: getContrastColor(theme.primary) }}
                                >
                                    {saving ? <Loader2 className="animate-spin" size={20} /> : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}

            <ImageEditorModal
                isOpen={editorOpen}
                onClose={() => setEditorOpen(false)}
                imageFile={rawSelectedImage}
                imageUrl={editorImageUrl}
                onSave={handleEditorSave}
                aspectRatio={editorTarget === 'cover' ? 16 / 9 : 1}
            />
        </AnimatePresence>
    );
}
