import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Canvas, useThree } from '@react-three/fiber';
import { useProgress, Html } from '@react-three/drei';
import { ArrowLeft, Loader2, Star, Info, Settings2, X, Trash2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, doc, getDoc, setDoc, updateDoc, increment, serverTimestamp, addDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { getContrastColor } from '../utils/colorUtils';
import GalleryEnvironment from '../components/gallery/GalleryEnvironment';
import ArtworkDetailsOverlay from '../components/gallery/ArtworkDetailsOverlay';
import ManageGalleryModal from '../components/gallery/ManageGalleryModal';

interface RoomData {
    id: string;
    userId: string;
    name: string;
    description: string;
    roomType?: string;
    ratingSum: number;
    ratingCount: number;
    ambientAudio?: string;
    enableGuestbook?: boolean;
    coCreatorId?: string;
}

interface ArtworkData {
    id: string;
    title: string;
    description?: string;
    imageUrl: string;
    userId: string;
    likesCount: number;
    commentsCount: number;
    url: string;
    likes: number;
    comments: number;
}

function LoadingOverlay() {
    const { progress } = useProgress();
    const { theme } = useAppContext();

    return (
        <Html center zIndexRange={[100, 100]}>
            <AnimatePresence>
                {progress < 100 && (
                    <motion.div
                        className="fixed inset-0 z-50 flex flex-col items-center justify-center p-8 backdrop-blur-xl w-screen h-screen"
                        style={{ backgroundColor: theme.background }}
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.2, ease: "easeInOut" }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.5 }}
                            className="flex flex-col items-center"
                        >
                            <div className="w-64 h-2 rounded-full overflow-hidden mb-4" style={{ backgroundColor: theme.surface }}>
                                <motion.div
                                    className="h-full rounded-full"
                                    style={{ backgroundColor: theme.primary }}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                    transition={{ ease: "linear", duration: 0.2 }}
                                />
                            </div>
                            <span className="font-bold text-lg" style={{ color: theme.text, opacity: 0.6 }}>
                                {Math.round(progress)}% loaded
                            </span>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </Html>
    );
}

function XRButtonContainer() {
    const { gl } = useThree();
    useEffect(() => {
        const button = VRButton.createButton(gl);
        button.style.position = 'absolute';
        button.style.bottom = '80px';
        button.style.left = '50%';
        button.style.transform = 'translateX(-50%)';
        button.style.zIndex = '99';
        button.style.padding = '12px 24px';
        button.style.borderRadius = '30px';
        button.style.background = 'rgba(0,0,0,0.85)';
        button.style.border = '2px solid #fcaab8';
        button.style.color = '#fcaab8';
        button.style.fontWeight = 'black';
        button.style.fontSize = '12px';
        button.style.letterSpacing = '0.05em';
        button.style.textTransform = 'uppercase';
        button.style.cursor = 'pointer';
        
        document.body.appendChild(button);
        return () => {
            button.remove();
        };
    }, [gl]);
    return null;
}

export default function GalleryPage() {
    const { id: roomId } = useParams();
    const navigate = useNavigate();
    const { theme } = useAppContext();
    const { user } = useAuth();

    const [room, setRoom] = useState<RoomData | null>(null);
    const [artworks, setArtworks] = useState<ArtworkData[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedArtwork, setSelectedArtwork] = useState<ArtworkData | null>(null);
    const [isManageGalleryModalOpen, setIsManageGalleryModalOpen] = useState(false);

    // Rating State
    const [userRating, setUserRating] = useState<number>(0);
    const [hoverRating, setHoverRating] = useState<number>(0);
    const [submittingRating, setSubmittingRating] = useState(false);

    // Exploration State
    const [exploreMode, setExploreMode] = useState(false);
    const [introDone, setIntroDone] = useState(false);

    // Orientation and Device Detection
    const [isMobile, setIsMobile] = useState(false);

    // Mobile movement controls
    const [mobileMovement, setMobileMovement] = useState({
        forward: false,
        backward: false,
        left: false,
        right: false
    });

    // Guestbook State
    const [isGuestbookOpen, setIsGuestbookOpen] = useState(false);
    const [guestbookEntries, setGuestbookEntries] = useState<any[]>([]);
    const [newGuestbookMessage, setNewGuestbookMessage] = useState('');
    const [submittingGuestbook, setSubmittingGuestbook] = useState(false);

    // Audio Playback
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        const handleResize = () => {
            const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
            const isSmallScreen = window.innerWidth < 1024;
            setIsMobile(isTouch || isSmallScreen);
        };

        window.addEventListener('resize', handleResize);
        handleResize(); // run initially

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const fetchRoomData = async () => {
            if (!roomId) return;

            try {
                // 1. Fetch Room Metadata
                const roomDoc = await getDoc(doc(db, 'rooms', roomId));
                if (roomDoc.exists()) {
                    setRoom({ id: roomDoc.id, ...roomDoc.data() } as RoomData);
                }

                // 2. Setup Real-time Listener for Room Artworks
                const q = query(collection(db, 'artworks'), where('roomId', '==', roomId));
                const unsubscribe = onSnapshot(q, (snapshot) => {
                    const fetchedArtworks = snapshot.docs.map(docSnap => ({
                        id: docSnap.id,
                        title: docSnap.data().title || 'Untitled',
                        description: docSnap.data().description || '',
                        imageUrl: docSnap.data().imageUrl,
                        url: docSnap.data().imageUrl,
                        userId: docSnap.data().userId,
                        frameIndex: docSnap.data().frameIndex,
                        likesCount: docSnap.data().likesCount || 0,
                        commentsCount: docSnap.data().commentsCount || 0,
                        likes: docSnap.data().likesCount || 0,
                        comments: docSnap.data().commentsCount || 0,
                    }));
                    setArtworks(fetchedArtworks);
                });

                // 3. Check if current user already rated this room
                if (user) {
                    const ratingDoc = await getDoc(doc(db, 'room_ratings', `${user.uid}_${roomId}`));
                    if (ratingDoc.exists()) {
                        setUserRating(ratingDoc.data().rating);
                    }
                }

                setLoading(false);
                return () => unsubscribe();
            } catch (error) {
                console.error("Error fetching room data:", error);
                setLoading(false);
            }
        };

        fetchRoomData();
    }, [roomId, user]);

    // Manage Background Music instantiation
    useEffect(() => {
        if (room?.ambientAudio) {
            if (!audioRef.current) {
                audioRef.current = new Audio(room.ambientAudio);
                audioRef.current.loop = true;
                audioRef.current.volume = 0.5;
            } else {
                audioRef.current.src = room.ambientAudio;
            }
        } else {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
                setIsPlayingAudio(false);
            }
        }
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
            }
        };
    }, [room?.ambientAudio]);

    // Live Guestbook syncing
    useEffect(() => {
        if (!roomId || !isGuestbookOpen) return;
        const q = query(
            collection(db, 'guestbook'), 
            where('roomId', '==', roomId)
        );
        const unsub = onSnapshot(q, (snapshot) => {
            const entries = snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data(),
                createdAt: docSnap.data().createdAt?.toDate()
            }));
            entries.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
            setGuestbookEntries(entries);
        });
        return () => unsub();
    }, [roomId, isGuestbookOpen]);

    const togglePlayAudio = () => {
        if (!audioRef.current) return;
        if (isPlayingAudio) {
            audioRef.current.pause();
            setIsPlayingAudio(false);
        } else {
            audioRef.current.play().then(() => {
                setIsPlayingAudio(true);
            }).catch(err => {
                console.warn("Audio play blocked:", err);
            });
        }
    };

    const handleSignGuestbook = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !roomId || !newGuestbookMessage.trim() || submittingGuestbook) return;
        setSubmittingGuestbook(true);
        try {
            await addDoc(collection(db, 'guestbook'), {
                roomId,
                userId: user.uid,
                authorName: user.displayName || 'Anonymous',
                authorPhoto: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
                message: newGuestbookMessage.trim(),
                createdAt: serverTimestamp()
            });
            setNewGuestbookMessage('');
        } catch (err) {
            console.error(err);
            alert("Failed to sign guestbook.");
        } finally {
            setSubmittingGuestbook(false);
        }
    };

    const handleDeleteGuestbookEntry = async (entryId: string) => {
        if (!confirm("Are you sure you want to delete this guestbook entry?")) return;
        try {
            await deleteDoc(doc(db, 'guestbook', entryId));
        } catch (err) {
            console.error(err);
            alert("Failed to delete entry.");
        }
    };

    const handleRateRoom = async (rating: number) => {
        if (!user || !roomId || !room || submittingRating) return;
        setSubmittingRating(true);

        try {
            const ratingId = `${user.uid}_${roomId}`;
            const ratingRef = doc(db, 'room_ratings', ratingId);
            const roomRef = doc(db, 'rooms', roomId);

            if (userRating > 0) {
                const difference = rating - userRating;
                await updateDoc(roomRef, {
                    ratingSum: increment(difference)
                });
                await updateDoc(ratingRef, { rating, updatedAt: serverTimestamp() });
            } else {
                await updateDoc(roomRef, {
                    ratingSum: increment(rating),
                    ratingCount: increment(1)
                });
                await setDoc(ratingRef, {
                    roomId,
                    userId: user.uid,
                    rating,
                    createdAt: serverTimestamp()
                });
                setRoom(prev => prev ? { ...prev, ratingCount: prev.ratingCount + 1 } : prev);

                if (room.userId && room.userId !== user.uid) {
                    await addDoc(collection(db, 'notifications'), {
                        ownerId: room.userId,
                        actorId: user.uid,
                        actorName: user.displayName || 'Someone',
                        actorPhoto: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
                        type: 'rate',
                        message: `rated your exhibition ${rating} stars.`,
                        contextId: room.id,
                        contextImage: null,
                        createdAt: serverTimestamp(),
                        read: false
                    });
                }
            }

            setRoom(prev => prev ? { ...prev, ratingSum: prev.ratingSum + (rating - userRating) } : prev);
            setUserRating(rating);
        } catch (error) {
            console.error("Error rating room:", error);
            alert("Failed to submit rating");
        } finally {
            setSubmittingRating(false);
        }
    };

    if (loading) {
        return (
            <div className="w-screen h-screen flex flex-col items-center justify-center" style={{ backgroundColor: theme.background, color: theme.text }}>
                <Loader2 className="animate-spin mb-4" size={48} />
                <h2 className="text-2xl font-black">Loading Exhibition Space...</h2>
            </div>
        );
    }

    return (
        <motion.div
            className="w-screen h-screen relative overflow-hidden transition-colors duration-1000"
            style={{ backgroundColor: theme.background }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
        >
            {/* Overlay UI */}
            <div className="absolute inset-x-0 top-8 px-4 md:px-8 flex justify-between items-start z-10 pointer-events-none">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="pointer-events-auto w-12 h-12 flex items-center justify-center rounded-full backdrop-blur-md transition-transform hover:scale-110 shadow-lg border-2 z-20 cursor-pointer"
                        style={{ backgroundColor: `${theme.surface}99`, color: theme.text, borderColor: theme.border }}
                    >
                        <ArrowLeft size={24} />
                    </button>

                    {/* Audio control button */}
                    {room?.ambientAudio && (
                        <button
                            onClick={togglePlayAudio}
                            className="pointer-events-auto w-12 h-12 flex items-center justify-center rounded-full backdrop-blur-md transition-transform hover:scale-110 shadow-lg border-2 z-20 cursor-pointer"
                            style={{ backgroundColor: `${theme.surface}99`, color: theme.text, borderColor: theme.border }}
                            title={isPlayingAudio ? "Mute Background Music" : "Play Background Music"}
                        >
                            {isPlayingAudio ? (
                                <span className="relative flex h-4 w-4 items-center justify-center">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#fcaab8] opacity-75"></span>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#fcaab8]"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                                </span>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
                            )}
                        </button>
                    )}
                </div>

                {room && (
                    <div className="pointer-events-auto flex flex-col items-end gap-3 md:gap-4 max-w-[200px] sm:max-w-xs md:max-w-sm">
                        {/* Room Info */}
                        <div
                            className="backdrop-blur-md px-4 py-3 md:px-6 md:py-4 rounded-3xl shadow-lg border text-right"
                            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                        >
                            <h1 className="text-lg md:text-2xl font-black leading-tight mb-0.5 md:mb-1 truncate" style={{ color: theme.text }}>{room.name}</h1>
                            {room.description && (
                                <p className="font-semibold text-xs md:text-sm line-clamp-2" style={{ color: theme.text, opacity: 0.8 }}>{room.description}</p>
                            )}
                            <div
                                className="mt-1 md:mt-2 inline-flex items-center gap-1.5 md:gap-2 px-2.5 py-0.5 md:px-3 md:py-1 rounded-full text-[10px] md:text-xs font-bold"
                                style={{ backgroundColor: theme.background, color: theme.text }}
                            >
                                <Info size={12} />
                                3D Exhibition
                            </div>
                        </div>

                        {/* Room Rating Interactor */}
                        {!selectedArtwork && !exploreMode && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="backdrop-blur-md px-4 py-3 md:px-6 md:py-4 rounded-3xl shadow-xl border flex flex-col items-center gap-1 md:gap-2"
                                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                            >
                                <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider" style={{ color: theme.text, opacity: 0.8 }}>
                                    {userRating > 0 ? 'Your Rating' : 'Rate this Room'}
                                </span>
                                <div className="flex gap-0.5 md:gap-1">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            disabled={submittingRating}
                                            onClick={() => handleRateRoom(star)}
                                            onMouseEnter={() => setHoverRating(star)}
                                            onMouseLeave={() => setHoverRating(0)}
                                            className="transition-transform hover:scale-125 disabled:opacity-50 cursor-pointer"
                                        >
                                            <Star
                                                size={ star <= (hoverRating || userRating) ? 22 : 18 }
                                                className={(hoverRating || userRating) >= star ? 'text-[#fcaab8] fill-[#fcaab8]' : 'text-gray-300'}
                                            />
                                        </button>
                                    ))}
                                </div>
                                <span className="text-[9px] md:text-xs font-bold mt-0.5" style={{ color: theme.text, opacity: 0.6 }}>
                                    Avg: {room.ratingCount > 0 ? (room.ratingSum / room.ratingCount).toFixed(1) : 'New'} ({room.ratingCount})
                                </span>
                            </motion.div>
                        )}
                        {/* Edit Room Button (Owner or Co-Creator) */}
                        {user && (room.userId === user.uid || room.coCreatorId === user.uid) && !selectedArtwork && !exploreMode && (
                            <motion.button
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                onClick={() => setIsManageGalleryModalOpen(true)}
                                className="pointer-events-auto backdrop-blur-md px-4 py-2.5 md:px-6 md:py-3 rounded-full shadow-xl border flex items-center gap-1.5 md:gap-2 font-bold text-xs md:text-sm transition-transform hover:scale-105 cursor-pointer"
                                style={{ backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }}
                            >
                                <Settings2 size={16} style={{ color: theme.primary }} />
                                Edit Room
                            </motion.button>
                        )}
                    </div>
                )}
            </div>

            {/* Intro / Explore Overlay */}
            <AnimatePresence>
                {!exploreMode && !selectedArtwork && !isGuestbookOpen && introDone && (
                    <motion.div
                        className="absolute inset-0 z-10 flex items-center justify-center p-8 pointer-events-none"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <div className="flex flex-col items-center gap-6 mt-48">
                            <button
                                id="explore-button"
                                onClick={() => {
                                    setExploreMode(true);
                                    if (audioRef.current) {
                                        audioRef.current.play().then(() => {
                                            setIsPlayingAudio(true);
                                        }).catch(e => console.warn(e));
                                    }
                                }}
                                className="pointer-events-auto border-4 px-10 py-4 md:px-12 md:py-5 rounded-full font-black text-xl md:text-2xl shadow-[0_10px_40px_rgba(252,170,184,0.3)] transition-all hover:scale-105 hover:brightness-110 flex items-center gap-3 cursor-pointer"
                                style={{
                                    backgroundColor: theme.primary,
                                    borderColor: theme.border,
                                    color: getContrastColor(theme.primary)
                                }}
                            >
                                Explore Room
                            </button>
                            <p className="text-white font-bold bg-black/40 px-6 py-2 rounded-full backdrop-blur-md text-center max-w-sm">
                                {isMobile 
                                    ? "Drag anywhere to look around. Use virtual controls to walk." 
                                    : "Use W, A, S, D keys to walk and click/drag to look around."}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Interaction Overlays */}
            <AnimatePresence>
                {selectedArtwork && (
                    <ArtworkDetailsOverlay
                        artwork={selectedArtwork}
                        onClose={() => {
                            setSelectedArtwork(null);
                            setExploreMode(true);
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Floating Exit Walkthrough / Explore Mode Button */}
            {exploreMode && !selectedArtwork && !isGuestbookOpen && (
                <button
                    onClick={() => {
                        setExploreMode(false);
                        if (document.pointerLockElement) {
                            document.exitPointerLock();
                        }
                    }}
                    className="absolute top-8 right-4 md:right-8 z-50 pointer-events-auto px-4 py-2.5 md:px-6 md:py-3 rounded-full backdrop-blur-md border shadow-lg font-black text-xs md:text-sm flex items-center gap-2 hover:scale-105 transition-all"
                    style={{ backgroundColor: `${theme.surface}CC`, borderColor: theme.border, color: theme.text }}
                >
                    <X size={16} style={{ color: theme.primary }} />
                    Exit Walkthrough
                </button>
            )}

            {/* Mobile Touch Movement D-pad */}
            {exploreMode && !selectedArtwork && !isGuestbookOpen && isMobile && (
                <div className="absolute bottom-24 left-6 md:left-8 z-50 flex flex-col items-center gap-1.5 pointer-events-auto select-none">
                    {/* Forward */}
                    <button
                        onTouchStart={() => setMobileMovement(prev => ({ ...prev, forward: true }))}
                        onTouchEnd={() => setMobileMovement(prev => ({ ...prev, forward: false }))}
                        onMouseDown={() => setMobileMovement(prev => ({ ...prev, forward: true }))}
                        onMouseUp={() => setMobileMovement(prev => ({ ...prev, forward: false }))}
                        className="w-14 h-14 rounded-full backdrop-blur-md border flex items-center justify-center bg-black/45 text-white active:bg-pink-500/40 active:scale-95 transition-all shadow-lg border-white/10"
                    >
                        <ChevronUp size={28} />
                    </button>
                    
                    {/* Left / Right */}
                    <div className="flex gap-7">
                        <button
                            onTouchStart={() => setMobileMovement(prev => ({ ...prev, left: true }))}
                            onTouchEnd={() => setMobileMovement(prev => ({ ...prev, left: false }))}
                            onMouseDown={() => setMobileMovement(prev => ({ ...prev, left: true }))}
                            onMouseUp={() => setMobileMovement(prev => ({ ...prev, left: false }))}
                            className="w-14 h-14 rounded-full backdrop-blur-md border flex items-center justify-center bg-black/45 text-white active:bg-pink-500/40 active:scale-95 transition-all shadow-lg border-white/10"
                        >
                            <ChevronLeft size={28} />
                        </button>
                        <button
                            onTouchStart={() => setMobileMovement(prev => ({ ...prev, right: true }))}
                            onTouchEnd={() => setMobileMovement(prev => ({ ...prev, right: false }))}
                            onMouseDown={() => setMobileMovement(prev => ({ ...prev, right: true }))}
                            onMouseUp={() => setMobileMovement(prev => ({ ...prev, right: false }))}
                            className="w-14 h-14 rounded-full backdrop-blur-md border flex items-center justify-center bg-black/45 text-white active:bg-pink-500/40 active:scale-95 transition-all shadow-lg border-white/10"
                        >
                            <ChevronRight size={28} />
                        </button>
                    </div>
                    
                    {/* Backward */}
                    <button
                        onTouchStart={() => setMobileMovement(prev => ({ ...prev, backward: true }))}
                        onTouchEnd={() => setMobileMovement(prev => ({ ...prev, backward: false }))}
                        onMouseDown={() => setMobileMovement(prev => ({ ...prev, backward: true }))}
                        onMouseUp={() => setMobileMovement(prev => ({ ...prev, backward: false }))}
                        className="w-14 h-14 rounded-full backdrop-blur-md border flex items-center justify-center bg-black/45 text-white active:bg-pink-500/40 active:scale-95 transition-all shadow-lg border-white/10"
                    >
                        <ChevronDown size={28} />
                    </button>
                </div>
            )}

            {/* Guestbook Overlay Modal */}
            <AnimatePresence>
                {isGuestbookOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8 bg-black/75 backdrop-blur-md">
                        <div className="absolute inset-0" onClick={() => { setIsGuestbookOpen(false); setExploreMode(true); }} />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 30 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 30 }}
                            className="w-full max-w-xl max-h-[85vh] flex flex-col rounded-[2.5rem] p-8 relative z-[70] border shadow-2xl overflow-hidden text-gray-800"
                            style={{
                                background: 'linear-gradient(to bottom, #f7f1e3, #ebdcb9)',
                                borderColor: '#c4a46a',
                                fontFamily: 'Georgia, serif'
                            }}
                        >
                            <div className="flex justify-between items-center mb-6 pb-4 border-b border-dashed border-[#c4a46a]">
                                <div>
                                    <h3 className="text-3xl font-bold text-[#5c4033] italic">Exhibition Guestbook</h3>
                                    <p className="text-xs text-[#8a6e53] font-sans font-black uppercase tracking-wider mt-1">Leave a warm trace of your presence</p>
                                </div>
                                <button
                                    onClick={() => { setIsGuestbookOpen(false); setExploreMode(true); }}
                                    className="p-2.5 bg-[#8b0000] hover:bg-[#a60000] text-white rounded-full transition-colors cursor-pointer"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto pr-2 mb-6 space-y-4 custom-scrollbar font-sans">
                                {guestbookEntries.length === 0 ? (
                                    <div className="text-center py-12 opacity-60 italic text-lg text-[#5c4033] font-serif">
                                        No signatures yet. Be the first to leave a message!
                                    </div>
                                ) : (
                                    guestbookEntries.map(entry => (
                                        <div key={entry.id} className="bg-white/50 backdrop-blur-sm p-4 rounded-2xl border border-[#ebdcb9] flex gap-3 items-start relative group shadow-sm transition-all hover:bg-white/85">
                                            <img
                                                src={entry.authorPhoto}
                                                alt="Author"
                                                className="w-10 h-10 rounded-full border border-[#ebdcb9] bg-[#f7f1e3]"
                                            />
                                            <div className="flex-1">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="font-bold text-sm text-[#5c4033]">{entry.authorName}</span>
                                                    <span className="text-[10px] text-gray-400 font-semibold">
                                                        {entry.createdAt ? entry.createdAt.toLocaleDateString() : ''}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-700 leading-relaxed font-serif italic">"{entry.message}"</p>
                                            </div>

                                            {user && (user.uid === entry.userId || user.uid === room?.userId) && (
                                                <button
                                                    onClick={() => handleDeleteGuestbookEntry(entry.id)}
                                                    className="absolute top-2 right-2 p-1 text-red-500 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                                    title="Delete signature"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>

                            {user ? (
                                <form onSubmit={handleSignGuestbook} className="flex flex-col gap-3 font-sans border-t border-dashed border-[#c4a46a] pt-4">
                                    <textarea
                                        value={newGuestbookMessage}
                                        onChange={(e) => setNewGuestbookMessage(e.target.value)}
                                        placeholder="Write your note here..."
                                        maxLength={250}
                                        rows={2}
                                        required
                                        className="w-full bg-white/70 border border-[#ebdcb9] focus:border-[#c4a46a] rounded-2xl py-3 px-4 outline-none resize-none font-serif italic text-base transition-all focus:bg-white"
                                    />
                                    <button
                                        type="submit"
                                        disabled={submittingGuestbook || !newGuestbookMessage.trim()}
                                        className="w-full py-3.5 rounded-full font-bold text-sm tracking-wide text-white transition-all transform hover:scale-[1.01] active:scale-95 disabled:opacity-50 cursor-pointer"
                                        style={{ backgroundColor: '#5c4033' }}
                                    >
                                        {submittingGuestbook ? 'Signing...' : 'Sign Guestbook'}
                                    </button>
                                </form>
                            ) : (
                                <div className="text-center font-sans text-xs font-semibold opacity-60 mt-4">
                                    Please log in to sign the guestbook.
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* 3D Canvas Context */}
            <div className={`absolute inset-0 transition-all duration-700 ${selectedArtwork ? 'scale-[1.02] filter blur-sm pointer-events-none' : ''}`}>
                <Canvas 
                    camera={{ position: [0, 1.8, 5], fov: 60 }} 
                    shadows={!isMobile} 
                    dpr={isMobile ? 1 : [1, 1.5]} 
                    onCreated={({ gl }) => { gl.xr.enabled = true; }}
                >
                    <React.Suspense fallback={<LoadingOverlay />}>
                        <LoadingOverlay />
                        <GalleryEnvironment
                            artworks={artworks}
                            roomType={room?.roomType || 'atrium'}
                            enableGuestbook={room?.enableGuestbook || false}
                            onGuestbookClick={() => {
                                setExploreMode(false);
                                if (document.pointerLockElement) {
                                    document.exitPointerLock();
                                }
                                setIsGuestbookOpen(true);
                            }}
                            onArtworkClick={(art) => {
                                setExploreMode(false);
                                if (document.pointerLockElement) {
                                    document.exitPointerLock();
                                }
                                setSelectedArtwork(art as unknown as ArtworkData);
                            }}
                            exploreMode={exploreMode}
                            introDone={introDone}
                            setIntroDone={setIntroDone}
                            onUnlock={() => setExploreMode(false)}
                            mobileMovement={mobileMovement}
                        />
                        <XRButtonContainer />
                    </React.Suspense>
                </Canvas>
            </div>

            {/* Guide overlay bottom center */}
            <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none transition-opacity duration-500 ${selectedArtwork || isGuestbookOpen ? 'opacity-0' : 'opacity-100'}`}>
                <div className="px-6 py-3 rounded-full backdrop-blur-md border shadow-lg transition-colors text-center"
                     style={{ backgroundColor: `${theme.primary}B3`, borderColor: theme.border, color: theme.text }}>
                    <p className="text-xs md:text-sm font-semibold tracking-wide">
                        {isMobile 
                            ? "Drag screen to look. Use D-pad to walk. Tap frames to view." 
                            : "Click and drag to look around. Use W, A, S, D to walk. Click frames."}
                    </p>
                </div>
            </div>

            <ManageGalleryModal
                isOpen={isManageGalleryModalOpen}
                onClose={() => setIsManageGalleryModalOpen(false)}
                roomId={roomId || ''}
            />
        </motion.div>
    );
}
