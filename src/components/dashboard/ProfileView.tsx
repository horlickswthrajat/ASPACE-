import { useState, useEffect } from 'react';
import { motion, type Variants, AnimatePresence } from 'framer-motion';
import { Settings, Loader2 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { getContrastColor } from '../../utils/colorUtils';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import EditRoomModal from '../EditRoomModal';
import { Edit2, Trash2 } from 'lucide-react';
import PartnersModal from './PartnersModal';

interface ProfileViewProps {
    containerVariants: Variants;
    itemVariants: Variants;
    onEditProfile: () => void;
}

interface UserRoom {
    id: string;
    name: string;
    description: string;
    imageUrl?: string;
    ratingSum: number;
    ratingCount: number;
    createdAt?: Date;
}

export default function ProfileView({ containerVariants, itemVariants, onEditProfile }: ProfileViewProps) {
    const { theme } = useAppContext();
    const { profile, user } = useAuth();
    const navigate = useNavigate();

    const [rooms, setRooms] = useState<UserRoom[]>([]);
    const [loadingGallery, setLoadingGallery] = useState(true);
    const [editingRoom, setEditingRoom] = useState<UserRoom | null>(null);
    const [roomToDelete, setRoomToDelete] = useState<{ id: string, name: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isPartnersModalOpen, setIsPartnersModalOpen] = useState(false);

    const fetchUserRooms = async () => {
        if (!user?.uid) {
            setLoadingGallery(false);
            return;
        }
        try {
            const q = query(collection(db, 'rooms'), where('userId', '==', user.uid));
            const snapshot = await getDocs(q);

            const fetchedRooms = snapshot.docs.map(doc => ({
                id: doc.id,
                name: doc.data().name || 'Untitled Room',
                description: doc.data().description || '',
                imageUrl: doc.data().imageUrl,
                ratingSum: doc.data().ratingSum || 0,
                ratingCount: doc.data().ratingCount || 0,
                createdAt: doc.data().createdAt?.toDate()
            }));

            fetchedRooms.sort((a, b) => {
                if (!a.createdAt || !b.createdAt) return 0;
                return b.createdAt.getTime() - a.createdAt.getTime();
            });

            setRooms(fetchedRooms);
        } catch (error) {
            console.error("Error fetching user rooms:", error);
        } finally {
            setLoadingGallery(false);
        }
    };

    const handleDeleteClick = (roomId: string, roomName: string) => {
        setRoomToDelete({ id: roomId, name: roomName });
    };

    const confirmDeleteRoom = async () => {
        if (!roomToDelete) return;

        setIsDeleting(true);
        try {
            // 1. Delete all artworks associated with the room
            const artworksRef = collection(db, 'artworks');
            const q = query(artworksRef, where('roomId', '==', roomToDelete.id));
            const querySnapshot = await getDocs(q);

            const batch = writeBatch(db);
            querySnapshot.forEach((docSnap) => {
                batch.delete(docSnap.ref);
            });
            await batch.commit();

            // 2. Delete the room itself
            await deleteDoc(doc(db, 'rooms', roomToDelete.id));

            // Refresh the list
            fetchUserRooms();
            setRoomToDelete(null);
        } catch (error) {
            console.error("Error deleting room:", error);
            alert("Failed to delete the exhibition. Please try again later.");
        } finally {
            setIsDeleting(false);
        }
    };

    // Fallbacks if not loaded yet
    const displayName = profile?.displayName || 'Artist';
    const avatarUrl = profile?.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback';
    const emailPrefix = profile?.email ? profile.email.split('@')[0] : displayName.toLowerCase().replace(/\s+/g, '');

    useEffect(() => {
        fetchUserRooms();
    }, [user?.uid]);

    return (
        <motion.div
            className="flex-1 overflow-y-auto px-4 md:px-10 pb-12 pt-4 md:pt-6 max-w-5xl mx-auto w-full"
            variants={containerVariants}
            initial="hidden"
            animate="show"
        >
            {/* Banner */}
            <motion.div
                variants={itemVariants}
                className="w-full h-48 rounded-[2rem] relative shadow-inner overflow-hidden"
                style={{ backgroundColor: `${theme.primary}B3` }}
            >
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
            </motion.div>

            {/* Profile Info (Overlapping Banner) */}
            <motion.div variants={itemVariants} className="flex flex-col items-center -mt-16 md:-mt-20 relative px-4 md:px-8">
                <div
                    className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden border-4 shadow-xl mb-4 relative z-10"
                    style={{ borderColor: theme.surface, backgroundColor: theme.primary }}
                >
                    <img src={avatarUrl} alt="User Profile" className="w-full h-full object-cover" />
                </div>

                <div className="flex flex-col md:flex-row w-full justify-between items-center md:items-start gap-6 md:gap-0">
                    <div className="hidden md:block w-32" /> {/* Spacer to balance layout */}

                    <div className="text-center flex-1">
                        <h1 className="text-2xl font-black tracking-wide" style={{ color: theme.text }}>{displayName}</h1>
                        <p className="font-semibold opacity-60 mt-1" style={{ color: theme.text }}>
                            @{emailPrefix}
                        </p>

                        <div className="flex flex-col items-center justify-center mt-4 md:mt-6">
                            <button
                                onClick={() => setIsPartnersModalOpen(true)}
                                className="text-center group p-2 rounded-xl transition-colors hover:bg-black/5"
                            >
                                <p className="font-bold text-xl transition-transform group-hover:scale-105" style={{ color: theme.text }}>{profile?.partnersCount || 0}</p>
                                <p className="text-sm font-semibold opacity-60 group-hover:opacity-100 transition-opacity" style={{ color: theme.text }}>Partners</p>
                            </button>
                        </div>
                    </div>

                    <div className="w-full md:w-32 flex justify-center md:justify-end">
                        <button
                            onClick={onEditProfile}
                            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-full font-bold transition-all hover:scale-105 active:scale-95 shadow-md w-full md:w-auto"
                            style={{ backgroundColor: theme.primary, color: getContrastColor(theme.primary) }}
                        >
                            <Settings size={18} />
                            Edit Profile
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* User Rooms Grid */}
            <motion.div variants={itemVariants} className="mt-12">
                <h2 className="text-xl font-bold tracking-tight mb-6" style={{ color: theme.text }}>My Exhibitions</h2>

                {loadingGallery ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="animate-spin" style={{ color: theme.text }} size={32} />
                    </div>
                ) : rooms.length === 0 ? (
                    <div className="text-center p-12 opacity-60 font-semibold" style={{ color: theme.text }}>
                        You haven't created any 3D rooms yet.
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
                        {rooms.map((room) => {
                            const averageRating = room.ratingCount > 0 ? (room.ratingSum / room.ratingCount).toFixed(1) : 'New';
                            return (
                                <motion.div
                                    key={room.id}
                                    className="rounded-2xl md:rounded-[2rem] overflow-hidden relative group shadow-sm border border-transparent transition-all flex flex-col h-56 md:h-64"
                                    whileHover={window.innerWidth > 768 ? { scale: 1.03, y: -5, transition: { duration: 0.2 }, borderColor: theme.primary } : {}}
                                    style={{ backgroundColor: theme.surface }}
                                >
                                    {/* Placeholder Room Graphic */}
                                    <div className="h-32 bg-gradient-to-br from-[#fcaab8] to-[#fadcc7] w-full relative overflow-hidden">
                                        {room.imageUrl && (
                                            <img src={room.imageUrl} alt={room.name} className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
                                        )}
                                        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                                        <h3 className="absolute bottom-3 left-5 right-5 text-white font-black text-xl truncate tracking-tight shadow-sm z-10">{room.name}</h3>
                                    </div>
                                    <div className="p-3 md:p-5 flex flex-col flex-1">
                                        <p className="text-[10px] md:text-sm font-medium line-clamp-2 flex-1" style={{ color: theme.text }}>{room.description || 'Step inside to explore this curated 3D collection.'}</p>
                                        <div className="flex justify-between items-center mt-4">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => navigate(`/gallery/${room.id}`)}
                                                    className="text-[10px] md:text-xs font-bold px-3 md:px-4 py-1.5 md:py-2 rounded-full transition-colors"
                                                    style={{ backgroundColor: theme.primary, color: getContrastColor(theme.primary) }}
                                                >
                                                    Enter
                                                </button>
                                                <button
                                                    onClick={() => setEditingRoom(room)}
                                                    className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition-colors shadow-sm"
                                                    title="Edit Exhibition"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteClick(room.id, room.name)}
                                                    className="p-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-full transition-colors shadow-sm"
                                                    title="Delete Exhibition"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-1 font-bold" style={{ color: theme.primary }}>
                                                ★ {averageRating}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </motion.div>

            <EditRoomModal
                isOpen={!!editingRoom}
                onClose={() => setEditingRoom(null)}
                room={editingRoom}
                onRoomUpdated={() => {
                    fetchUserRooms();
                }}
            />

            {/* Custom Delete Confirmation Modal */}
            <AnimatePresence>
                {roomToDelete && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => !isDeleting && setRoomToDelete(null)}
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-sm rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center border"
                            style={{ backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }}
                        >
                            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 text-red-500" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                                <Trash2 size={32} />
                            </div>
                            <h3 className="text-xl font-bold mb-2">Delete Exhibition?</h3>
                            <p className="mb-6 opacity-80">
                                Are you sure you want to delete <span className="font-bold opacity-100">"{roomToDelete.name}"</span>? This action cannot be undone and will delete all artworks inside it.
                            </p>

                            <div className="flex w-full gap-3">
                                <button
                                    onClick={() => setRoomToDelete(null)}
                                    disabled={isDeleting}
                                    className="flex-1 py-3 rounded-xl font-bold transition-colors disabled:opacity-50 border hover:brightness-110"
                                    style={{ backgroundColor: 'transparent', color: theme.text, borderColor: theme.border }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDeleteRoom}
                                    disabled={isDeleting}
                                    className="flex-1 py-3 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isDeleting ? <Loader2 className="animate-spin" size={20} /> : 'Delete'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {isPartnersModalOpen && user && (
                <PartnersModal
                    isOpen={isPartnersModalOpen}
                    onClose={() => setIsPartnersModalOpen(false)}
                    userId={user.uid}
                />
            )}
        </motion.div>
    );
}
