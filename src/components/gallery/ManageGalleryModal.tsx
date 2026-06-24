import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Loader2, Image as ImageIcon, Edit2, RefreshCw } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useAuth, type UserProfile } from '../../context/AuthContext';
import { db, storage } from '../../lib/firebase';
import { collection, query, where, doc, deleteDoc, onSnapshot, addDoc, serverTimestamp, updateDoc, getDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { compressImage } from '../../utils/imageCompression';
import ImageEditorModal from '../ImageEditorModal';
import { getCloudinaryConfig, getCloudinaryVideoUploadUrl } from '../../utils/cloudinaryUtils';
import { getContrastColor } from '../../utils/colorUtils';

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
    deleting?: boolean;
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

    // Tab view & gallery custom settings state
    const [activeTab, setActiveTab] = useState<'artworks' | 'settings'>('artworks');
    const [roomData, setRoomData] = useState<any>(null);
    const [partnersList, setPartnersList] = useState<UserProfile[]>([]);
    const [uploadingAudio, setUploadingAudio] = useState(false);
    const audioInputRef = useRef<HTMLInputElement>(null);

    // Sync from Firestore for this room
    useEffect(() => {
        if (!isOpen || !user || !roomId) return;

        setLoading(true);

        // Fetch room details
        const fetchRoomData = async () => {
            try {
                const roomSnap = await getDoc(doc(db, 'rooms', roomId));
                if (roomSnap.exists()) {
                    setRoomData({ id: roomSnap.id, ...roomSnap.data() });
                }
            } catch (err) {
                console.error("Error fetching room details:", err);
            }
        };
        fetchRoomData();

        // Fetch user's partners list
        const partnershipsRef = collection(db, 'partnerships');
        const qPartners = query(partnershipsRef);
        const unsubPartners = onSnapshot(qPartners, async (snapshot) => {
            const partnerIds: string[] = [];
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                if (data.status === 'accepted' && (data.user1 === user.uid || data.user2 === user.uid)) {
                    const otherId = data.user1 === user.uid ? data.user2 : data.user1;
                    partnerIds.push(otherId);
                }
            });

            const fetchedProfiles: UserProfile[] = [];
            for (const pid of partnerIds) {
                try {
                    const userDoc = await getDoc(doc(db, 'users', pid));
                    if (userDoc.exists()) {
                        fetchedProfiles.push(userDoc.data() as UserProfile);
                    }
                } catch (e) {
                    console.error("Error fetching partner profile", e);
                }
            }
            setPartnersList(fetchedProfiles);
        });

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
                        newFrames[i] = {
                            index: i, file: null, previewUrl: null, title: '', uploading: false, uploadedUrl: null, firestoreId: null
                        };
                    }
                }
                return newFrames;
            });
            setLoading(false);
        });

        return () => {
            unsubscribe();
            unsubPartners();
        };
    }, [isOpen, user, roomId]);

    if (!isOpen) return null;

    const handleUpdateRoomSetting = async (field: string, value: any) => {
        if (!roomId) return;
        try {
            await updateDoc(doc(db, 'rooms', roomId), {
                [field]: value,
                updatedAt: serverTimestamp()
            });
            setRoomData((prev: any) => prev ? { ...prev, [field]: value } : prev);
        } catch (err) {
            console.error("Failed to update room setting:", err);
            alert("Failed to update gallery setting.");
        }
    };

    const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && user && roomId) {
            const file = e.target.files[0];
            setUploadingAudio(true);
            try {
                const config = getCloudinaryConfig();
                const uploadUrl = getCloudinaryVideoUploadUrl();
                const formData = new FormData();
                formData.append('file', file);
                formData.append('upload_preset', config.uploadPreset);

                const res = await fetch(uploadUrl, {
                    method: 'POST',
                    body: formData
                });
                if (!res.ok) throw new Error("Audio upload failed");
                const data = await res.json();
                
                await handleUpdateRoomSetting('ambientAudio', data.secure_url);
                await handleUpdateRoomSetting('audioGuideTitle', file.name);
            } catch (err) {
                console.error(err);
                alert("Failed to upload audio file.");
            } finally {
                setUploadingAudio(false);
            }
        }
    };

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

            if (existingId) {
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
        e.stopPropagation();
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
                    className="w-full max-w-6xl max-h-full h-full flex flex-col rounded-[2xl] p-4 md:p-8 relative z-10 border shadow-2xl overflow-hidden animate-fade-in"
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
                    <div className="flex justify-between items-center mb-4 px-2">
                        <div>
                            <h2 className="text-3xl font-black tracking-tight mb-1">Customize Exhibition Room</h2>
                            <p className="font-semibold opacity-60">Fine-tune your artworks, physical settings, aesthetics, and audio properties.</p>
                        </div>
                        <button onClick={onClose} className="p-3 bg-black/5 hover:bg-black/10 rounded-full transition-colors flex-shrink-0">
                            <X size={24} />
                        </button>
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex gap-4 mb-6 border-b px-2" style={{ borderColor: theme.border }}>
                        <button
                            onClick={() => setActiveTab('artworks')}
                            className={`pb-4 px-4 font-bold text-lg border-b-2 transition-all cursor-pointer ${activeTab === 'artworks' ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`}
                            style={{ borderBottomColor: activeTab === 'artworks' ? theme.primary : 'transparent' }}
                        >
                            Exhibition Artworks
                        </button>
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`pb-4 px-4 font-bold text-lg border-b-2 transition-all cursor-pointer ${activeTab === 'settings' ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`}
                            style={{ borderBottomColor: activeTab === 'settings' ? theme.primary : 'transparent' }}
                        >
                            Room Settings
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-2 pb-6 custom-scrollbar">
                        {loading ? (
                            <div className="flex justify-center items-center h-64">
                                <Loader2 className="animate-spin text-primary" size={48} style={{ color: theme.primary }} />
                            </div>
                        ) : activeTab === 'artworks' ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                {frames.map((frame, i) => (
                                    <div key={i} className="flex flex-col gap-2">
                                        <div
                                            onClick={() => {
                                                if (frame.uploading || frame.deleting || frame.firestoreId) return;
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
                        ) : (
                            <div className="flex flex-col gap-8 max-w-2xl mx-auto py-4">
                                {/* Theme Selection */}
                                <div className="flex flex-col gap-2">
                                    <label className="font-bold text-lg">Gallery Style (Theme)</label>
                                    <p className="text-sm opacity-60 font-semibold mb-2">Change the architectural layout, materials, and lighting of the 3D room.</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        {[
                                            { id: 'atrium', name: 'Atrium', desc: 'Modern day gallery with a centerpiece low-poly tree' },
                                            { id: 'classical_salon', name: 'Classical Salon', desc: 'Ivory columns, gold moldings, and warm lighting' },
                                            { id: 'industrial_warehouse', name: 'Industrial Warehouse', desc: 'Dark brick walls, sawtooth roof skylights, and ceiling beams' },
                                            { id: 'neon_void', name: 'Neon Void', desc: 'Reflective black floor with floating wireframes and neon light strips' }
                                        ].map(preset => (
                                            <div
                                                key={preset.id}
                                                onClick={() => handleUpdateRoomSetting('roomType', preset.id)}
                                                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all hover:scale-[1.02] ${roomData?.roomType === preset.id ? 'border-transparent shadow-md bg-opacity-20' : 'opacity-70 border-gray-300'}`}
                                                style={{
                                                    borderColor: roomData?.roomType === preset.id ? theme.primary : undefined,
                                                    backgroundColor: roomData?.roomType === preset.id ? `${theme.primary}20` : undefined
                                                }}
                                            >
                                                <h4 className="font-black text-lg mb-1">{preset.name}</h4>
                                                <p className="text-xs font-semibold opacity-70 leading-snug">{preset.desc}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Joint Exhibition Co-Creator Selection */}
                                <div className="flex flex-col gap-2 border-t pt-6" style={{ borderColor: theme.border }}>
                                    <label className="font-bold text-lg">Joint Exhibition (Co-Creator)</label>
                                    <p className="text-sm opacity-60 font-semibold mb-2">Invite one of your partners to showcase their artwork in this room alongside yours.</p>
                                    
                                    <select
                                        value={roomData?.coCreatorId || ''}
                                        onChange={(e) => handleUpdateRoomSetting('coCreatorId', e.target.value || null)}
                                        className="w-full border rounded-2xl py-3.5 px-5 focus:outline-none focus:ring-4 font-semibold shadow-sm transition-all"
                                        style={{
                                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                            borderColor: theme.border,
                                            color: theme.text,
                                            '--tw-ring-color': theme.primary
                                        } as any}
                                    >
                                        <option value="">No Co-Creator (Single Exhibition)</option>
                                        {partnersList.map(partner => (
                                            <option key={partner.uid} value={partner.uid}>
                                                {partner.displayName} (@{partner.username})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Background Music / Audio Guide Selection */}
                                <div className="flex flex-col gap-2 border-t pt-6" style={{ borderColor: theme.border }}>
                                    <label className="font-bold text-lg">Ambient Audio & Guides</label>
                                    <p className="text-sm opacity-60 font-semibold mb-2">Add ambient sounds or upload a narrated guide to introduce your gallery to visitors.</p>
                                    
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        {[
                                            { name: 'No Audio', url: '' },
                                            { name: 'Classical Piano', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
                                            { name: 'Acoustic Guitar', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
                                            { name: 'Deep Space Ambient', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' }
                                        ].map(preset => (
                                            <div
                                                key={preset.name}
                                                onClick={() => handleUpdateRoomSetting('ambientAudio', preset.url)}
                                                className={`p-3 rounded-xl border-2 cursor-pointer transition-all hover:scale-[1.02] text-center ${roomData?.ambientAudio === preset.url ? 'border-transparent shadow-md' : 'opacity-70 border-gray-300'}`}
                                                style={{
                                                    borderColor: roomData?.ambientAudio === preset.url ? theme.primary : undefined,
                                                    backgroundColor: roomData?.ambientAudio === preset.url ? `${theme.primary}20` : undefined
                                                }}
                                            >
                                                <span className="font-bold text-sm">{preset.name}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Custom Audio Upload */}
                                    <div className="flex items-center gap-4 p-4 rounded-2xl border" style={{ borderColor: theme.border }}>
                                        <div className="flex-1">
                                            <h5 className="font-bold text-sm">Upload Custom Audio Guide</h5>
                                            <p className="text-xs opacity-60 font-medium">{roomData?.audioGuideTitle || 'No custom audio file uploaded.'}</p>
                                        </div>
                                        <button
                                            type="button"
                                            disabled={uploadingAudio}
                                            onClick={() => audioInputRef.current?.click()}
                                            className="px-4 py-2.5 rounded-full font-bold text-xs shadow-sm transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
                                            style={{ backgroundColor: theme.primary, color: getContrastColor(theme.primary) }}
                                        >
                                            {uploadingAudio ? 'Uploading...' : 'Choose MP3'}
                                        </button>
                                        <input
                                            type="file"
                                            ref={audioInputRef}
                                            onChange={handleAudioUpload}
                                            accept="audio/mp3,audio/*"
                                            className="hidden"
                                        />
                                    </div>
                                </div>

                                {/* Guestbook Toggle */}
                                <div className="flex items-center justify-between border-t pt-6" style={{ borderColor: theme.border }}>
                                    <div>
                                        <label className="font-bold text-lg block">Physical Guestbook Table</label>
                                        <p className="text-sm opacity-60 font-semibold max-w-sm">Enable a physical guestbook at the entrance where visitors can leave notes and sketches.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleUpdateRoomSetting('enableGuestbook', !roomData?.enableGuestbook)}
                                        className="w-16 h-8 rounded-full transition-colors relative cursor-pointer"
                                        style={{ backgroundColor: roomData?.enableGuestbook ? theme.primary : '#ccc' }}
                                    >
                                        <span
                                            className="w-6 h-6 rounded-full bg-white absolute top-1 transition-all shadow-md"
                                            style={{ left: roomData?.enableGuestbook ? '2.2rem' : '4px' }}
                                        />
                                    </button>
                                </div>
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
