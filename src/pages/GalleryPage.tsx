import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { useProgress, Html } from '@react-three/drei';
import { ArrowLeft, Loader2, Star, Info, Settings2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, doc, getDoc, setDoc, updateDoc, increment, serverTimestamp, addDoc, onSnapshot } from 'firebase/firestore';
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
}

interface ArtworkData {
    id: string;
    title: string;
    description?: string;
    imageUrl: string;
    userId: string;
    likesCount: number;
    commentsCount: number;
    url: string; // Required by Artwork
    likes: number; // Required by Artwork
    comments: number; // Required by Artwork
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

export default function GalleryPage() {
    const { id: roomId } = useParams(); // URL param is now the roomId
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
                        url: docSnap.data().imageUrl, // GalleryEnvironment expects 'url'
                        userId: docSnap.data().userId,
                        frameIndex: docSnap.data().frameIndex, // Required for physical placement
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

    const handleRateRoom = async (rating: number) => {
        if (!user || !roomId || !room || submittingRating) return;
        setSubmittingRating(true);

        try {
            const ratingId = `${user.uid}_${roomId}`;
            const ratingRef = doc(db, 'room_ratings', ratingId);
            const roomRef = doc(db, 'rooms', roomId);

            if (userRating > 0) {
                // User is updating their existing rating
                const difference = rating - userRating;
                await updateDoc(roomRef, {
                    ratingSum: increment(difference)
                });
                await updateDoc(ratingRef, { rating, updatedAt: serverTimestamp() });
            } else {
                // New rating
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
                // Optimistically update local room stats
                setRoom(prev => prev ? { ...prev, ratingCount: prev.ratingCount + 1 } : prev);

                // Send Notification
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

            // Optimistically update local UI rating sum
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
            <div className="absolute inset-x-0 top-8 px-8 flex justify-between items-start z-10 pointer-events-none">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="pointer-events-auto w-12 h-12 flex items-center justify-center rounded-full backdrop-blur-md transition-transform hover:scale-110 shadow-lg border-2 z-20"
                    style={{ backgroundColor: `${theme.surface}99`, color: theme.text, borderColor: theme.border }}
                >
                    <ArrowLeft size={24} />
                </button>

                {room && (
                    <div className="pointer-events-auto flex flex-col items-end gap-4">
                        {/* Room Info */}
                        <div
                            className="backdrop-blur-md px-6 py-4 rounded-3xl shadow-lg border max-w-sm text-right"
                            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                        >
                            <h1 className="text-2xl font-black leading-tight mb-1" style={{ color: theme.text }}>{room.name}</h1>
                            {room.description && (
                                <p className="font-semibold text-sm line-clamp-2" style={{ color: theme.text, opacity: 0.8 }}>{room.description}</p>
                            )}
                            <div
                                className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold"
                                style={{ backgroundColor: theme.background, color: theme.text }}
                            >
                                <Info size={14} />
                                3D Exhibition
                            </div>
                        </div>

                        {/* Room Rating Interactor */}
                        {!selectedArtwork && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="backdrop-blur-md px-6 py-4 rounded-3xl shadow-xl border flex flex-col items-center gap-2"
                                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                            >
                                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.text, opacity: 0.8 }}>
                                    {userRating > 0 ? 'Your Rating' : 'Rate this Room'}
                                </span>
                                <div className="flex gap-1">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            disabled={submittingRating}
                                            onClick={() => handleRateRoom(star)}
                                            onMouseEnter={() => setHoverRating(star)}
                                            onMouseLeave={() => setHoverRating(0)}
                                            className="transition-transform hover:scale-125 disabled:opacity-50"
                                        >
                                            <Star
                                                size={28}
                                                className={(hoverRating || userRating) >= star ? 'text-[#f594a6] fill-[#f594a6]' : 'text-gray-300'}
                                            />
                                        </button>
                                    ))}
                                </div>
                                <span className="text-xs font-bold mt-1" style={{ color: theme.text, opacity: 0.6 }}>
                                    Avg: {room.ratingCount > 0 ? (room.ratingSum / room.ratingCount).toFixed(1) : 'New'} ({room.ratingCount} reviews)
                                </span>
                            </motion.div>
                        )}
                        {/* Edit Room Button (Owner Only) */}
                        {user && room.userId === user.uid && !selectedArtwork && (
                            <motion.button
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                onClick={() => setIsManageGalleryModalOpen(true)}
                                className="pointer-events-auto backdrop-blur-md px-6 py-3 rounded-full shadow-xl border flex items-center gap-2 font-bold transition-transform hover:scale-105"
                                style={{ backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }}
                            >
                                <Settings2 size={20} style={{ color: theme.primary }} />
                                Edit Room
                            </motion.button>
                        )}
                    </div>
                )}
            </div>

            {/* Intro / Explore Overlay */}
            <AnimatePresence>
                {!exploreMode && !selectedArtwork && introDone && (
                    <motion.div
                        className="absolute inset-0 z-10 flex items-center justify-center p-8 pointer-events-none"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <div className="flex flex-col items-center gap-6 mt-48">
                            <button
                                id="explore-button"
                                onClick={() => setExploreMode(true)}
                                className="pointer-events-auto border-4 px-12 py-5 rounded-full font-black text-2xl shadow-[0_10px_40px_rgba(252,170,184,0.3)] transition-all hover:scale-105 hover:brightness-110 flex items-center gap-3"
                                style={{
                                    backgroundColor: theme.primary,
                                    borderColor: theme.border,
                                    color: getContrastColor(theme.primary)
                                }}
                            >
                                Explore Room
                            </button>
                            <p className="text-white font-bold bg-black/40 px-6 py-2 rounded-full backdrop-blur-md">
                                Use W,A,S,D to move and Mouse to look around.
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Interaction Overlay */}
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

            {/* 3D Canvas Context */}
            <div className={`absolute inset-0 transition-all duration-700 ${selectedArtwork ? 'scale-[1.02] filter blur-sm pointer-events-none' : ''}`}>
                <Canvas camera={{ position: [0, 1.8, 5], fov: 60 }} shadows>
                    <React.Suspense fallback={<LoadingOverlay />}>
                        <LoadingOverlay />
                        <GalleryEnvironment
                            artworks={artworks}
                            roomType={room?.roomType || 'atrium'}
                            onArtworkClick={(art) => {
                                setExploreMode(false);
                                // To ensure lock drops before state changes (browser dependent)
                                if (document.pointerLockElement) {
                                    document.exitPointerLock();
                                }
                                setSelectedArtwork(art as unknown as ArtworkData);
                            }}
                            exploreMode={exploreMode}
                            introDone={introDone}
                            setIntroDone={setIntroDone}
                            onUnlock={() => setExploreMode(false)}
                        />
                    </React.Suspense>
                </Canvas>
            </div>

            {/* Guide overlay bottom center */}
            <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none transition-opacity duration-500 ${selectedArtwork ? 'opacity-0' : 'opacity-100'}`}>
                <div className="px-6 py-3 rounded-full backdrop-blur-md border shadow-lg transition-colors"
                    style={{ backgroundColor: `${theme.primary}B3`, borderColor: theme.border, color: theme.text }}>
                    <p className="text-sm font-semibold tracking-wide">Click and drag to look around. Click artworks to interact.</p>
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
