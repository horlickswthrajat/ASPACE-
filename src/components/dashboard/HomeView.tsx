import { useState, useEffect, useMemo } from 'react';
import { motion, type Variants } from 'framer-motion';
import { Loader2, ChevronDown, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { getContrastColor } from '../../utils/colorUtils';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, limit, getDocs, where, documentId } from 'firebase/firestore';

interface Room {
    id: string;
    name: string;
    description: string;
    userId: string;
    imageUrl?: string;
    ratingSum: number;
    ratingCount: number;
    createdAt?: Date;
}

type SortOption = 'newest' | 'oldest' | 'rating-high' | 'rating-low';

interface HomeViewProps {
    containerVariants: Variants;
    itemVariants: Variants;
    onArtistClick: (userId: string) => void;
}

export default function HomeView({ containerVariants, itemVariants, onArtistClick }: HomeViewProps) {
    const navigate = useNavigate();
    const { theme } = useAppContext();
    
    // Rooms State
    const [rooms, setRooms] = useState<Room[]>([]);
    const [userProfiles, setUserProfiles] = useState<Record<string, { displayName: string, photoURL: string }>>({});
    const [loadingRooms, setLoadingRooms] = useState(true);
    const [sortBy, setSortBy] = useState<SortOption>('newest');

    // Artists State
    const [artists, setArtists] = useState<any[]>([]);
    const [loadingArtists, setLoadingArtists] = useState(true);

    // Fetch Rooms & Profiles
    useEffect(() => {
        const fetchRooms = async () => {
            try {
                // Fetch a generous batch of rooms to sort client-side (to avoid composite index hell for now)
                const q = query(collection(db, 'rooms'), orderBy('createdAt', 'desc'), limit(50));
                const snapshot = await getDocs(q);

                const fetchedRooms = snapshot.docs.map(doc => ({
                    id: doc.id,
                    name: doc.data().name || 'Untitled Room',
                    description: doc.data().description || '',
                    imageUrl: doc.data().imageUrl,
                    userId: doc.data().userId,
                    ratingSum: doc.data().ratingSum || 0,
                    ratingCount: doc.data().ratingCount || 0,
                    createdAt: doc.data().createdAt?.toDate()
                }));

                setRooms(fetchedRooms);

                // Fetch user profiles for the unique userIds
                const uniqueUserIds = [...new Set(fetchedRooms.map(r => r.userId))].filter(Boolean);
                if (uniqueUserIds.length > 0) {
                    const profilesMap: Record<string, any> = {};

                    // Fetch in chunks of 30 due to Firestore 'in' query limits
                    for (let i = 0; i < uniqueUserIds.length; i += 30) {
                        const chunk = uniqueUserIds.slice(i, i + 30);
                        const usersRef = collection(db, 'users');
                        const usersQuery = query(usersRef, where(documentId(), 'in', chunk));
                        const usersSnapshot = await getDocs(usersQuery);

                        usersSnapshot.forEach(doc => {
                            profilesMap[doc.id] = {
                                displayName: doc.data().displayName,
                                photoURL: doc.data().photoURL,
                            };
                        });
                    }
                    setUserProfiles(profilesMap);
                }

            } catch (error) {
                console.error("Error fetching rooms or users:", error);
            } finally {
                setLoadingRooms(false);
            }
        };

        fetchRooms();
    }, []);

    // Fetch Artists for swipe section
    useEffect(() => {
        const fetchArtists = async () => {
            try {
                const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(15));
                const snapshot = await getDocs(q);
                const fetchedArtists = snapshot.docs.map(doc => ({
                    uid: doc.id,
                    ...doc.data()
                }));
                setArtists(fetchedArtists);
            } catch (error) {
                console.error("Error fetching artists in HomeView:", error);
            } finally {
                setLoadingArtists(false);
            }
        };

        fetchArtists();
    }, []);

    const sortedRooms = useMemo(() => {
        const roomsCopy = [...rooms];
        return roomsCopy.sort((a, b) => {
            const avgA = a.ratingCount > 0 ? a.ratingSum / a.ratingCount : 0;
            const avgB = b.ratingCount > 0 ? b.ratingSum / b.ratingCount : 0;
            const timeA = a.createdAt?.getTime() || 0;
            const timeB = b.createdAt?.getTime() || 0;

            switch (sortBy) {
                case 'newest': return timeB - timeA;
                case 'oldest': return timeA - timeB;
                case 'rating-high': return avgB - avgA;
                case 'rating-low': return avgA - avgB;
                default: return 0;
            }
        });
    }, [rooms, sortBy]);

    if (loadingRooms) {
        return (
            <div className="flex-1 flex items-center justify-center h-full">
                <Loader2 className="animate-spin text-gray-400" size={48} />
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto px-3 md:px-10 pb-20 md:pb-12 pt-2 md:pt-8 custom-scrollbar">
            {/* 1. Explore Rooms Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3 mb-6 max-w-7xl mx-auto">
                <div>
                    <h1 className="text-xl md:text-3xl font-black mb-0.5" style={{ color: theme.text }}>Explore Rooms</h1>
                    <p className="font-semibold opacity-60 text-xs md:text-base" style={{ color: theme.text }}>Discover curated 3D exhibitions from artists worldwide.</p>
                </div>

                <div className="relative group self-stretch md:self-auto">
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                        className="appearance-none font-bold py-2 md:py-3 pl-4 pr-10 rounded-full shadow-sm border focus:outline-none focus:ring-2 cursor-pointer transition-colors focus:ring-opacity-50 text-xs md:text-sm w-full md:w-auto"
                        style={{ backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }}
                    >
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                        <option value="rating-high">Highest Rated</option>
                        <option value="rating-low">Lowest Rated</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-[#fcaab8] transition-colors">
                        <ChevronDown size={16} />
                    </div>
                </div>
            </div>

            {rooms.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12 text-center px-4 max-w-7xl mx-auto">
                    <h2 className="text-xl md:text-2xl font-black mb-1" style={{ color: theme.text }}>No Exhibitions Yet</h2>
                    <p className="opacity-60 text-sm md:text-lg font-semibold" style={{ color: theme.text }}>
                        Be the first to create a 3D Room using the Builder tab!
                    </p>
                </div>
            ) : (
                <motion.div
                    className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6 max-w-7xl mx-auto"
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                >
                    {sortedRooms.map((room) => {
                        const averageRating = room.ratingCount > 0 ? (room.ratingSum / room.ratingCount).toFixed(1) : 'New';

                        return (
                            <motion.div
                                key={room.id}
                                variants={itemVariants}
                                whileHover={window.innerWidth > 768 ? { y: -5, scale: 1.02, transition: { duration: 0.2 } } : {}}
                                className="rounded-xl md:rounded-[2.5rem] overflow-hidden relative group transition-all flex flex-col h-52 md:h-72 neumorphic-glass"
                                style={{ backgroundColor: theme.surface, color: theme.text }}
                            >
                                {/* Visual Thumbnail graphic */}
                                <div className="h-28 md:h-40 bg-gradient-to-br from-[#fdf2eb] to-[#fadcc7] w-full relative overflow-hidden flex items-center justify-center p-3 md:p-6 text-center">
                                    {room.imageUrl && (
                                        <img src={room.imageUrl} alt={room.name} className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
                                    )}
                                    <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

                                    <h3 className="text-white font-black text-sm md:text-xl tracking-tight z-10 leading-tight drop-shadow-md line-clamp-2">
                                        {room.name}
                                    </h3>

                                    <div className="absolute top-2 md:top-4 right-2 md:right-4 bg-white/90 backdrop-blur-sm px-2 md:px-3 py-1 md:py-1.5 rounded-full flex items-center gap-1 md:gap-1.5 shadow-sm transform group-hover:scale-110 transition-transform">
                                        <Star size={10} className="fill-[#fcaab8] text-[#fcaab8]" />
                                        <span className="text-[9px] md:text-xs font-black text-gray-800">{averageRating}</span>
                                    </div>
                                </div>

                                <div className="p-2.5 md:p-6 flex flex-col flex-1 transform transition-transform justify-between">
                                    <p className="text-[9px] md:text-sm font-medium line-clamp-2 leading-snug flex-1 mb-2" style={{ color: theme.text, opacity: 0.8 }}>
                                        {room.description || 'Step inside to explore this curated 3D collection.'}
                                    </p>

                                    <div className="flex justify-between items-center border-t border-gray-100/10 pt-2">
                                        <div
                                            className="flex items-center gap-1 md:gap-2 cursor-pointer group/creator"
                                            onClick={(e) => { e.stopPropagation(); onArtistClick(room.userId); }}
                                        >
                                            <img
                                                src={userProfiles[room.userId]?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${room.userId}`}
                                                alt="Creator"
                                                className="w-6 h-6 md:w-9 md:h-9 rounded-full bg-gray-100 object-cover border-2 border-transparent group-hover/creator:border-[#fcaab8] transition-all hover:scale-110"
                                                title={userProfiles[room.userId]?.displayName || 'Creator'}
                                            />
                                        </div>

                                        <button
                                            onClick={() => navigate(`/gallery/${room.id}`)}
                                            className="text-[9px] md:text-xs font-bold px-2.5 md:px-4 py-1 md:py-1.5 rounded-full transition-colors shadow-sm cursor-pointer"
                                            style={{ backgroundColor: theme.primary, color: getContrastColor(theme.primary) }}
                                        >
                                            Enter
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </motion.div>
            )}

            {/* 2. Artists Swipe Section */}
            <div className="mt-10 mb-6 max-w-7xl mx-auto border-t pt-8" style={{ borderColor: theme.border }}>
                <div className="mb-4">
                    <h2 className="text-xl md:text-2xl font-black mb-0.5" style={{ color: theme.text }}>Discover Artists</h2>
                    <p className="font-semibold opacity-60 text-xs md:text-sm" style={{ color: theme.text }}>Swipe through creators and explore their virtual galleries.</p>
                </div>

                {loadingArtists ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="animate-spin text-gray-400" size={24} />
                    </div>
                ) : artists.length === 0 ? (
                    <p className="opacity-50 text-xs">No creators registered yet.</p>
                ) : (
                    <div className="flex gap-3 md:gap-4 overflow-x-auto pb-4 pt-2 scrollbar-none snap-x scroll-smooth scrollbar-none">
                        {artists.map((artist) => (
                            <motion.div
                                key={artist.uid}
                                className="w-28 md:w-44 p-3 md:p-4 rounded-xl md:rounded-2xl flex flex-col items-center text-center flex-shrink-0 snap-start neumorphic-glass relative overflow-hidden group border"
                                style={{ backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }}
                            >
                                <div className="w-12 h-12 md:w-16 md:h-16 rounded-full overflow-hidden border-2 mb-2 bg-gray-100 flex-shrink-0" style={{ borderColor: theme.border }}>
                                    <img
                                        src={artist.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${artist.uid}`}
                                        alt={artist.displayName || 'Artist'}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <h4 className="text-[10px] md:text-sm font-bold truncate w-full mb-0.5" style={{ color: theme.text }}>
                                    {artist.displayName || 'Anonymous'}
                                </h4>
                                <p className="text-[8px] md:text-xs font-semibold opacity-50 mb-3 truncate w-full" style={{ color: theme.text }}>
                                    {artist.artStyles && artist.artStyles.length > 0 ? artist.artStyles[0] : 'Creator'}
                                </p>
                                <button
                                    onClick={() => onArtistClick(artist.uid)}
                                    className="w-full py-1 rounded-lg text-[8px] md:text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer mt-auto"
                                    style={{ backgroundColor: theme.primary, color: getContrastColor(theme.primary) }}
                                >
                                    View Profile
                                </button>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
