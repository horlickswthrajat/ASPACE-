import React, { useState, useRef, Suspense } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { Loader2, ArrowRight, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { compressImage } from '../../utils/imageCompression';
import { getContrastColor } from '../../utils/colorUtils';
import ImageEditorModal from '../ImageEditorModal';
import { getCloudinaryConfig } from '../../utils/cloudinaryUtils';
import { Canvas } from '@react-three/fiber';
import { useProgress, Html } from '@react-three/drei';
import GalleryEnvironment from '../gallery/GalleryEnvironment';

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

const MOCK_ARTWORKS = [
    {
        id: 'mock-1',
        title: 'Echoes of Atrium',
        description: 'A study on geometric structures and daylight patterns.',
        imageUrl: '/floor-pattern.jpg',
        url: '/floor-pattern.jpg',
        userId: 'system',
        likesCount: 14,
        commentsCount: 2,
        likes: 14,
        comments: 2,
        frameIndex: 0
    },
    {
        id: 'mock-2',
        title: 'Industrial Planks',
        description: 'Natural wood grains blended with raw concrete accents.',
        imageUrl: '/birch_planks.png',
        url: '/birch_planks.png',
        userId: 'system',
        likesCount: 28,
        commentsCount: 5,
        likes: 28,
        comments: 5,
        frameIndex: 1
    },
    {
        id: 'mock-3',
        title: 'Stucco Textures',
        description: 'Detailed analysis of gallery wall materials and lighting reflections.',
        imageUrl: '/wall-pattern.jpg',
        url: '/wall-pattern.jpg',
        userId: 'system',
        likesCount: 9,
        commentsCount: 1,
        likes: 9,
        comments: 1,
        frameIndex: 2
    },
    {
        id: 'mock-4',
        title: 'Midnight Light',
        description: 'Vibrant colors reflecting off high-gloss dark surfaces.',
        imageUrl: '/floor-pattern.jpg',
        url: '/floor-pattern.jpg',
        userId: 'system',
        likesCount: 42,
        commentsCount: 8,
        likes: 42,
        comments: 8,
        frameIndex: 3
    }
];

function LoadingOverlay() {
    const { progress } = useProgress();
    const { theme } = useAppContext();

    return (
        <Html center zIndexRange={[100, 100]}>
            <div 
                className="fixed inset-0 z-50 flex flex-col items-center justify-center p-8 backdrop-blur-xl w-screen h-screen"
                style={{ backgroundColor: theme.background }}
            >
                <div className="flex flex-col items-center">
                    <div className="w-64 h-2 rounded-full overflow-hidden mb-4" style={{ backgroundColor: theme.surface }}>
                        <div
                            className="h-full rounded-full"
                            style={{ backgroundColor: theme.primary, width: `${progress}%` }}
                        />
                    </div>
                    <span className="font-bold text-lg" style={{ color: theme.text, opacity: 0.6 }}>
                        {Math.round(progress)}% loaded
                    </span>
                </div>
            </div>
        </Html>
    );
}

export default function CreateRoomWizard({ containerVariants }: CreateRoomWizardProps) {
    const { theme } = useAppContext();
    const { user } = useAuth();

    // Step 1: Room Info
    const [step, setStep] = useState<1 | 2>(1);
    const [step1Sub, setStep1Sub] = useState<'choose_style' | 'enter_details'>('choose_style');
    const [roomName, setRoomName] = useState('');
    const [roomDescription, setRoomDescription] = useState('');
    const [roomType, setRoomType] = useState<'atrium' | 'classical_salon' | 'industrial_warehouse' | 'neon_void'>('atrium');
    const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
    const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
    const [creatingRoom, setCreatingRoom] = useState(false);
    const [roomId, setRoomId] = useState<string | null>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);

    // Background Audio Setting
    const [ambientAudio, setAmbientAudio] = useState('');

    // 3D Preview State
    const [previewingRoomType, setPreviewingRoomType] = useState<'atrium' | 'classical_salon' | 'industrial_warehouse' | 'neon_void' | null>(null);
    const [exploreMode, setExploreMode] = useState(false);
    const [introDone, setIntroDone] = useState(false);
    const [selectedArtwork, setSelectedArtwork] = useState<any | null>(null);

    // Step 2: Frames
    const [frames, setFrames] = useState<FrameSlot[]>(
        Array.from({ length: TOTAL_SLOTS }, (_, i) => ({
            index: i, file: null, previewUrl: null, title: '', description: '', uploading: false, uploadedUrl: null, firestoreId: null
        }))
    );
    const [activeFrameIndex, setActiveFrameIndex] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const bulkFileInputRef = useRef<HTMLInputElement>(null);

    // Image Editor State
    const [editorOpen, setEditorOpen] = useState(false);
    const [editorTarget, setEditorTarget] = useState<'cover' | 'frame'>('cover');
    const [rawSelectedImage, setRawSelectedImage] = useState<File | null>(null);

    // Publishing State
    const [isPublishing, setIsPublishing] = useState(false);
    const [publishingProgress, setPublishingProgress] = useState(0);
    const [totalToPublish, setTotalToPublish] = useState(0);

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
                ambientAudio: ambientAudio,
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

    const handleBulkFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const selectedFiles = Array.from(e.target.files);
            setFrames(prev => {
                const next = [...prev];
                let fileIdx = 0;
                for (let i = 0; i < next.length; i++) {
                    if (!next[i].file && fileIdx < selectedFiles.length) {
                        const file = selectedFiles[fileIdx];
                        next[i] = {
                            ...next[i],
                            file: file,
                            previewUrl: URL.createObjectURL(file),
                            title: file.name.substring(0, file.name.lastIndexOf('.')) || file.name,
                            description: ''
                        };
                        fileIdx++;
                    }
                }
                return next;
            });
        }
        if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
    };

    const handleSingleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && activeFrameIndex !== null) {
            const file = e.target.files[0];
            setFrames(prev => prev.map(f =>
                f.index === activeFrameIndex
                    ? {
                        ...f,
                        file: file,
                        previewUrl: URL.createObjectURL(file),
                        title: file.name.substring(0, file.name.lastIndexOf('.')) || file.name,
                        description: ''
                      }
                    : f
            ));
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleEditorSave = async (croppedFile: File) => {
        setEditorOpen(false);

        if (editorTarget === 'cover') {
            setCoverImageFile(croppedFile);
            setCoverImagePreview(URL.createObjectURL(croppedFile));
        } else if (editorTarget === 'frame' && activeFrameIndex !== null) {
            setFrames(prev => prev.map(f =>
                f.index === activeFrameIndex
                    ? { ...f, file: croppedFile, previewUrl: URL.createObjectURL(croppedFile) }
                    : f
            ));
        }
    };

    const handleTitleChange = (frameIndex: number, newTitle: string) => {
        setFrames(prev => prev.map(f => f.index === frameIndex ? { ...f, title: newTitle } : f));
    };

    const handleDescriptionChange = (frameIndex: number, newDescription: string) => {
        setFrames(prev => prev.map(f => f.index === frameIndex ? { ...f, description: newDescription } : f));
    };

    const handlePublishGallery = async () => {
        if (!roomId || !user) return;

        const populatedFrames = frames.filter(f => f.file !== null);
        if (populatedFrames.length === 0) {
            window.location.reload();
            return;
        }

        setIsPublishing(true);
        setTotalToPublish(populatedFrames.length);
        setPublishingProgress(0);

        try {
            const config = getCloudinaryConfig();

            for (let i = 0; i < populatedFrames.length; i++) {
                const frame = populatedFrames[i];
                
                // 1. Compress & Upload to Cloudinary
                const compressedFile = await compressImage(frame.file!, 1920, 0.8);
                const formData = new FormData();
                formData.append('file', compressedFile);
                formData.append('upload_preset', config.uploadPreset);

                const cloudinaryReq = await fetch(config.uploadUrl, {
                    method: 'POST',
                    body: formData,
                });

                if (!cloudinaryReq.ok) throw new Error(`Cloudinary upload failed for artwork: ${frame.title}`);
                const cloudinaryRes = await cloudinaryReq.json();
                const downloadUrl = cloudinaryRes.secure_url;

                // 2. Save to Firestore
                await addDoc(collection(db, 'artworks'), {
                    userId: user.uid,
                    roomId: roomId,
                    frameIndex: frame.index,
                    title: frame.title || 'Untitled',
                    description: frame.description || '',
                    imageUrl: downloadUrl,
                    likesCount: 0,
                    commentsCount: 0,
                    createdAt: serverTimestamp()
                });

                // Update progress
                setPublishingProgress(prev => prev + 1);
            }

            window.location.reload();
        } catch (error) {
            console.error("Publishing error:", error);
            alert("Failed to publish some artworks. Please check your network and try again.");
            setIsPublishing(false);
        }
    };


    if (previewingRoomType) {
        return (
            <div className="fixed inset-0 z-[100] w-screen h-screen overflow-hidden flex flex-col" style={{ backgroundColor: theme.background }}>
                {/* 3D Canvas */}
                <div className={`absolute inset-0 transition-all duration-700 ${selectedArtwork ? 'scale-[1.02] filter blur-sm pointer-events-none' : ''}`}>
                    <Canvas camera={{ position: [0, 1.8, 5], fov: 60 }} shadows dpr={[1, 2]} onCreated={({ gl }) => { gl.xr.enabled = false; }}>
                        <Suspense fallback={<LoadingOverlay />}>
                            <GalleryEnvironment
                                artworks={MOCK_ARTWORKS as any}
                                roomType={previewingRoomType}
                                enableGuestbook={false}
                                onArtworkClick={(art) => {
                                    setExploreMode(false);
                                    if (document.pointerLockElement) {
                                        document.exitPointerLock();
                                    }
                                    setSelectedArtwork(art);
                                }}
                                exploreMode={exploreMode}
                                introDone={introDone}
                                setIntroDone={setIntroDone}
                                onUnlock={() => setExploreMode(false)}
                            />
                        </Suspense>
                    </Canvas>
                </div>

                {/* Overlay UI */}
                <div className="absolute inset-x-0 top-8 px-8 flex justify-between items-start z-10 pointer-events-none">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                if (document.pointerLockElement) {
                                    document.exitPointerLock();
                                }
                                setPreviewingRoomType(null);
                                setExploreMode(false);
                                setSelectedArtwork(null);
                            }}
                            className="pointer-events-auto px-6 py-3.5 rounded-full backdrop-blur-md transition-transform hover:scale-105 shadow-lg border-2 font-bold flex items-center gap-2 cursor-pointer"
                            style={{ backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }}
                        >
                            ← Exit Preview
                        </button>
                    </div>

                    <div className="pointer-events-auto flex flex-col items-end gap-4">
                        {/* Info card */}
                        <div
                            className="backdrop-blur-md px-6 py-4 rounded-3xl shadow-lg border max-w-sm text-right"
                            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                        >
                            <h1 className="text-2xl font-black leading-tight mb-1" style={{ color: theme.text }}>
                                {previewingRoomType.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                            </h1>
                            <p className="font-semibold text-xs opacity-75" style={{ color: theme.text }}>
                                Walk inside this design template to test the look before building.
                            </p>
                        </div>

                        {/* Select Button */}
                        {!selectedArtwork && (
                            <button
                                onClick={() => {
                                    if (document.pointerLockElement) {
                                        document.exitPointerLock();
                                    }
                                    setRoomType(previewingRoomType);
                                    setPreviewingRoomType(null);
                                    setExploreMode(false);
                                    setSelectedArtwork(null);
                                }}
                                className="pointer-events-auto px-8 py-4 rounded-full shadow-2xl border flex items-center gap-2 font-black text-lg transition-transform hover:scale-105 cursor-pointer"
                                style={{ backgroundColor: theme.primary, color: getContrastColor(theme.primary), borderColor: theme.border }}
                            >
                                Use This Design
                            </button>
                        )}
                    </div>
                </div>

                {/* Explore button overlay */}
                <AnimatePresence>
                    {!exploreMode && !selectedArtwork && introDone && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center p-8 pointer-events-none">
                            <div className="flex flex-col items-center gap-6 mt-48">
                                <button
                                    id="explore-button"
                                    onClick={() => {
                                        setExploreMode(true);
                                    }}
                                    className="pointer-events-auto border-4 px-12 py-5 rounded-full font-black text-2xl shadow-xl transition-all hover:scale-105 flex items-center gap-3 cursor-pointer animate-pulse"
                                    style={{
                                        backgroundColor: theme.primary,
                                        borderColor: theme.border,
                                        color: getContrastColor(theme.primary)
                                    }}
                                >
                                    Explore Room
                                </button>
                                <p className="text-white font-bold bg-black/40 px-6 py-2 rounded-full backdrop-blur-md text-sm">
                                    Use W, A, S, D to walk and Mouse to look around.
                                </p>
                            </div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Mini Mock Artwork Details Overlay */}
                <AnimatePresence>
                    {selectedArtwork && (
                        <motion.div
                            className="fixed right-16 top-1/2 -translate-y-1/2 z-50 w-96 rounded-[2rem] p-6 shadow-2xl backdrop-blur-xl border-2 pointer-events-auto"
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 50 }}
                            style={{ backgroundColor: `${theme.primary}E6`, color: theme.text, borderColor: theme.border }}
                        >
                            <button 
                                onClick={() => {
                                    setSelectedArtwork(null);
                                    setExploreMode(true);
                                }} 
                                className="absolute top-4 right-4 opacity-50 hover:opacity-100 transition-opacity"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>

                            <div className="flex-1 mb-4">
                                <h3 className="text-2xl font-bold mb-2">{selectedArtwork.title}</h3>
                                <p className="text-sm opacity-80 leading-relaxed">{selectedArtwork.description}</p>
                            </div>

                            <div className="flex items-center gap-3 mb-6 opacity-80">
                                <div className="w-8 h-8 rounded-full border border-white/40 bg-white/30 flex items-center justify-center font-bold text-xs">S</div>
                                <span className="font-semibold text-sm">Sample Artist <span className="font-normal opacity-70">creator</span></span>
                            </div>

                            <div className="flex flex-col gap-3">
                                <div
                                    className="flex items-center justify-between px-5 py-4 rounded-2xl border bg-white/5"
                                    style={{ borderColor: theme.border }}
                                >
                                    <div className="flex items-center gap-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="red" stroke="red"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                                        <span className="font-semibold">Likes</span>
                                    </div>
                                    <span className="text-sm font-bold">{selectedArtwork.likesCount}</span>
                                </div>

                                <button
                                    onClick={() => {
                                        setSelectedArtwork(null);
                                        setExploreMode(true);
                                    }}
                                    className="w-full mt-4 py-4 rounded-2xl font-bold transition-all shadow-md text-center border-2 border-transparent hover:border-[#fcaab8]"
                                    style={{ backgroundColor: theme.text, color: theme.background }}
                                >
                                    Resume Exploring
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Bottom Guide */}
                <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none transition-opacity duration-500 ${selectedArtwork ? 'opacity-0' : 'opacity-100'}`}>
                    <div className="px-6 py-3 rounded-full backdrop-blur-md border shadow-lg"
                         style={{ backgroundColor: `${theme.primary}B3`, borderColor: theme.border, color: theme.text }}>
                        <p className="text-sm font-semibold tracking-wide">Click Explore to start moving. Click works to inspect.</p>
                    </div>
                </div>
            </div>
        );
    }

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
                {step === 1 && step1Sub === 'choose_style' && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto py-4 md:py-0">
                        <h1 className="text-2xl md:text-4xl font-black mb-2 tracking-tight text-center" style={{ color: theme.text }}>Select a Gallery Template</h1>
                        <p className="font-semibold mb-8 text-sm md:text-base text-center" style={{ color: theme.text, opacity: 0.6 }}>Choose from our 3D room templates. You can preview it first or start building immediately.</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[
                                { 
                                    id: 'atrium' as const, 
                                    name: 'Atrium Gallery', 
                                    badge: 'Modernist',
                                    desc: 'Minimalist architecture featuring high glass walls, a beautiful low-poly centerpiece tree, and soft ambient daylight.', 
                                    gradient: 'linear-gradient(135deg, #a5f3fc 0%, #0284c7 100%)'
                                },
                                { 
                                    id: 'classical_salon' as const, 
                                    name: 'Classical Salon', 
                                    badge: 'Neoclassical',
                                    desc: 'Elegant imperial-style room adorned with classical columns, ivory molding, gold trims, and warm decorative lighting.', 
                                    gradient: 'linear-gradient(135deg, #fef3c7 0%, #d97706 100%)'
                                },
                                { 
                                    id: 'industrial_warehouse' as const, 
                                    name: 'Industrial Warehouse', 
                                    badge: 'Loft / Studio',
                                    desc: 'Spacious urban loft space with exposed dark brick walls, timber ceiling support beams, concrete floors, and skylights.', 
                                    gradient: 'linear-gradient(135deg, #e2e8f0 0%, #475569 100%)'
                                },
                                { 
                                    id: 'neon_void' as const, 
                                    name: 'Neon Void', 
                                    badge: 'Cyberpunk',
                                    desc: 'An immersive digital dimension of glowing ambient outlines, neon color bands, wireframes, and dark reflective floors.', 
                                    gradient: 'linear-gradient(135deg, #f472b6 0%, #701a75 100%)'
                                }
                            ].map(preset => (
                                <div
                                    key={preset.id}
                                    className="p-6 rounded-[2rem] border-2 flex flex-col justify-between hover:scale-[1.01] transition-all relative overflow-hidden group min-h-[250px]"
                                    style={{
                                        borderColor: theme.border,
                                        backgroundColor: theme.surface,
                                        boxShadow: '0 10px 30px -10px rgba(0,0,0,0.05)'
                                    }}
                                >
                                    <div 
                                        className="absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-500" 
                                        style={{ background: preset.gradient }}
                                    />

                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="font-black text-xl md:text-2xl" style={{ color: theme.text }}>{preset.name}</h3>
                                            <span className="text-xs font-black px-2.5 py-1 rounded-full uppercase" style={{ backgroundColor: `${theme.primary}20`, color: theme.primary }}>
                                                {preset.badge}
                                            </span>
                                        </div>
                                        <p className="text-sm font-semibold leading-relaxed opacity-75 mb-6 pr-8" style={{ color: theme.text }}>
                                            {preset.desc}
                                        </p>
                                    </div>

                                    <div className="flex gap-4 mt-auto z-10">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPreviewingRoomType(preset.id);
                                                setExploreMode(false);
                                                setIntroDone(false);
                                                setSelectedArtwork(null);
                                            }}
                                            className="flex-1 py-3.5 rounded-2xl font-bold text-sm transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                                            style={{
                                                backgroundColor: `${theme.text}10`,
                                                color: theme.text
                                            }}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>
                                            Watch Room
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setRoomType(preset.id);
                                                setStep1Sub('enter_details');
                                            }}
                                            className="flex-1 py-3.5 rounded-2xl font-bold text-sm transition-all hover:scale-[1.02] flex items-center justify-center gap-2 shadow-md"
                                            style={{
                                                backgroundColor: theme.primary,
                                                color: getContrastColor(theme.primary)
                                            }}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                                            Create Room
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {step === 1 && step1Sub === 'enter_details' && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl mx-auto py-4 md:py-0">
                        <button
                            type="button"
                            onClick={() => setStep1Sub('choose_style')}
                            className="mb-6 font-bold text-sm flex items-center gap-1.5 opacity-70 hover:opacity-100 transition-opacity"
                            style={{ color: theme.text }}
                        >
                            ← Back to Templates
                        </button>
                        
                        <h1 className="text-2xl md:text-4xl font-black mb-2 tracking-tight" style={{ color: theme.text }}>
                            Room Settings
                        </h1>
                        <p className="font-semibold mb-6 md:mb-8 text-sm md:text-base" style={{ color: theme.text, opacity: 0.6 }}>
                            Customize the name, cover photo, and background music for your new <strong>{roomType.replace('_', ' ')}</strong> room.
                        </p>

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
                                    required
                                    value={roomName}
                                    onChange={(e) => setRoomName(e.target.value)}
                                    placeholder="e.g. Summer Collection '24"
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

                            {/* Background Music Selector */}
                            <div>
                                <label className="block text-sm font-bold mb-2 ml-2" style={{ color: theme.text, opacity: 0.8 }}>Ambient Background Music</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { name: '🎵 No Music', url: '' },
                                        { name: '🎹 Classical Piano', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
                                        { name: '🎸 Acoustic Guitar', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
                                        { name: '🌌 Space Ambient', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' }
                                    ].map(preset => {
                                        const isSelected = ambientAudio === preset.url;
                                        return (
                                            <div
                                                key={preset.name}
                                                onClick={() => setAmbientAudio(preset.url)}
                                                className={`p-3.5 rounded-2xl border-2 text-center cursor-pointer transition-all hover:scale-[1.02] font-bold text-sm ${isSelected ? 'border-transparent shadow-md' : 'opacity-70'}`}
                                                style={{
                                                    borderColor: isSelected ? 'transparent' : theme.border,
                                                    backgroundColor: isSelected ? `${theme.primary}15` : 'rgba(0, 0, 0, 0.02)',
                                                    color: theme.text
                                                }}
                                            >
                                                {preset.name}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={!roomName.trim() || creatingRoom}
                                className="w-full py-4 rounded-[1.5rem] font-bold text-lg shadow-xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2 mt-4"
                                style={{ backgroundColor: theme.primary, color: getContrastColor(theme.primary) }}
                            >
                                {creatingRoom ? <Loader2 className="animate-spin" /> : 'Create Room & Continue'}
                                {!creatingRoom && <ArrowRight size={20} />}
                            </button>
                        </form>
                    </motion.div>
                )}

                {step === 2 && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                            <div>
                                <h1 className="text-2xl md:text-3xl font-black mb-1" style={{ color: theme.text }}>{roomName}</h1>
                                <p className="font-semibold text-sm opacity-60" style={{ color: theme.text }}>
                                    Select all your artworks together or one by one. Crop them, add names/descriptions, then publish them all at once.
                                </p>
                            </div>
                            
                            <button
                                onClick={() => bulkFileInputRef.current?.click()}
                                className="px-6 py-3.5 rounded-2xl font-black text-sm shadow-md transition-all hover:scale-105 flex items-center gap-2 cursor-pointer"
                                style={{ backgroundColor: theme.primary, color: getContrastColor(theme.primary) }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                                Select Multiple Artworks (Bulk)
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {frames.map((frame, i) => (
                                <div 
                                    key={i} 
                                    className="p-5 rounded-[2rem] border-2 flex flex-col gap-4 transition-all"
                                    style={{ 
                                        borderColor: frame.previewUrl ? theme.border : `${theme.border}80`,
                                        backgroundColor: theme.surface
                                    }}
                                >
                                    <div
                                        onClick={() => {
                                            setActiveFrameIndex(i);
                                            fileInputRef.current?.click();
                                        }}
                                        className={`aspect-square rounded-2xl border-2 flex items-center justify-center relative overflow-hidden transition-all ${frame.previewUrl ? 'shadow-md border-transparent' : 'border-dashed cursor-pointer'}`}
                                        style={{ 
                                            borderColor: frame.previewUrl ? 'transparent' : theme.border, 
                                            backgroundColor: 'rgba(0,0,0,0.02)' 
                                        }}
                                    >
                                        {frame.previewUrl ? (
                                            <>
                                                <img src={frame.previewUrl} alt={`Frame ${i + 1}`} className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                                                    <span className="text-white font-bold bg-black/50 px-4 py-2 rounded-full backdrop-blur-md text-xs">Change Photo</span>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center opacity-40 transition-colors" style={{ color: theme.text }}>
                                                <ImageIcon size={36} className="mb-2" />
                                                <span className="font-bold text-sm">Frame Slot {i + 1}</span>
                                                <span className="text-[10px] font-semibold mt-1">Empty Slot</span>
                                            </div>
                                        )}
                                    </div>

                                    {frame.previewUrl ? (
                                        <div className="flex flex-col gap-3 w-full">
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-wider mb-1 opacity-60" style={{ color: theme.text }}>Artwork Name</label>
                                                <input
                                                    type="text"
                                                    value={frame.title}
                                                    onChange={(e) => handleTitleChange(i, e.target.value)}
                                                    placeholder="e.g. Starry Night"
                                                    className="text-sm font-bold border rounded-xl px-3 py-2 outline-none w-full shadow-sm"
                                                    style={{
                                                        backgroundColor: 'rgba(0,0,0,0.02)',
                                                        borderColor: theme.border,
                                                        color: theme.text,
                                                    }}
                                                />
                                            </div>
                                            
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-wider mb-1 opacity-60" style={{ color: theme.text }}>Description</label>
                                                <textarea
                                                    value={frame.description}
                                                    onChange={(e) => handleDescriptionChange(i, e.target.value)}
                                                    placeholder="What does this represent?"
                                                    rows={2}
                                                    className="text-xs font-semibold border rounded-xl px-3 py-2 outline-none w-full resize-none shadow-sm"
                                                    style={{
                                                        backgroundColor: 'rgba(0,0,0,0.02)',
                                                        borderColor: theme.border,
                                                        color: theme.text,
                                                    }}
                                                />
                                            </div>

                                            <div className="flex gap-2 mt-1">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setRawSelectedImage(frame.file);
                                                        setEditorTarget('frame');
                                                        setActiveFrameIndex(i);
                                                        setEditorOpen(true);
                                                    }}
                                                    className="flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-all hover:bg-black/5 flex items-center justify-center gap-1 cursor-pointer"
                                                    style={{ borderColor: theme.border, color: theme.text }}
                                                >
                                                    📐 Crop
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setFrames(prev => prev.map(f => f.index === i ? { ...f, file: null, previewUrl: null, title: '', description: '' } : f));
                                                    }}
                                                    className="px-3 py-2 rounded-xl text-xs font-bold transition-all hover:bg-red-50 text-red-500 border-2 border-transparent hover:border-red-200 cursor-pointer"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-4">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setActiveFrameIndex(i);
                                                    fileInputRef.current?.click();
                                                }}
                                                className="px-4 py-2 rounded-xl text-xs font-bold transition-colors hover:brightness-95 cursor-pointer"
                                                style={{ backgroundColor: `${theme.primary}15`, color: theme.primary }}
                                            >
                                                + Add Artwork
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleSingleFileSelect}
                            accept="image/*"
                            className="hidden"
                        />

                        <input
                            type="file"
                            ref={bulkFileInputRef}
                            onChange={handleBulkFileSelect}
                            accept="image/*"
                            multiple
                            className="hidden"
                        />

                        <div className="mt-12 flex justify-between items-center border-t pt-8" style={{ borderColor: theme.border }}>
                            <p className="text-sm font-semibold opacity-60" style={{ color: theme.text }}>
                                {frames.filter(f => f.file !== null).length} of 12 slots filled
                            </p>
                            <div className="flex gap-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        window.location.reload();
                                    }}
                                    className="px-6 py-3.5 rounded-2xl font-bold text-sm bg-white/5 border hover:bg-white/10 transition-colors"
                                    style={{ borderColor: theme.border, color: theme.text }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handlePublishGallery}
                                    className="px-8 py-3.5 rounded-2xl font-black text-sm shadow-xl transition-all hover:scale-105"
                                    style={{ backgroundColor: theme.primary, color: getContrastColor(theme.primary) }}
                                >
                                    Publish Room & Artworks
                                </button>
                            </div>
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

            {isPublishing && (
                <div 
                    className="absolute inset-0 z-[999] backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
                    style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
                >
                    <div 
                        className="p-8 rounded-[2.5rem] max-w-sm w-full border flex flex-col items-center gap-6 shadow-2xl"
                        style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                    >
                        <Loader2 className="animate-spin" size={48} style={{ color: theme.primary }} />
                        <div>
                            <h3 className="text-xl font-black mb-1" style={{ color: theme.text }}>Publishing Gallery</h3>
                            <p className="text-xs font-semibold opacity-70 mb-4" style={{ color: theme.text }}>Uploading and compressing your artworks...</p>
                            <div className="w-full bg-black/10 rounded-full h-2.5 overflow-hidden relative">
                                <div 
                                    className="h-full rounded-full transition-all duration-300"
                                    style={{ 
                                        backgroundColor: theme.primary,
                                        width: `${(publishingProgress / totalToPublish) * 100}%`
                                    }}
                                />
                            </div>
                            <span className="text-xs font-black mt-2 block" style={{ color: theme.text }}>
                                {publishingProgress} / {totalToPublish} Uploaded
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </motion.div>
    );
}
