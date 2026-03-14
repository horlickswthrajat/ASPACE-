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

export default function HomeView({ containerVariants, itemVariants }: { containerVariants: Variants, itemVariants: Variants }) {
    const navigate = useNavigate();
    const { theme } = useAppContext();
    const [rooms, setRooms] = useState<Room[]>([]);
    const [userProfiles, setUserProfiles] = useState<Record<string, { displayName: string, photoURL: string }>>({});
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState<SortOption>('newest');

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
                setLoading(false);
            }
        };

        fetchRooms();
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


    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center h-full">
                <Loader2 className="animate-spin text-gray-400" size={48} />
            </div>
        );
    }

    if (rooms.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center h-full text-center px-8">
                <h2 className="text-2xl font-black mb-2" style={{ color: theme.text }}>No Exhibitions Yet</h2>
                <p className="opacity-60 text-lg font-semibold" style={{ color: theme.text }}>
                    Be the first to create a 3D Room using the Builder tab!
                </p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto px-4 md:px-10 pb-12 pt-4 md:pt-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8 max-w-7xl mx-auto">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black mb-1" style={{ color: theme.text }}>Explore Rooms</h1>
                    <p className="font-semibold opacity-60 text-sm md:text-base" style={{ color: theme.text }}>Discover curated 3D exhibitions from artists worldwide.</p>
                </div>

                <div className="relative group">
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                        className="appearance-none font-bold py-3 pl-5 pr-12 rounded-full shadow-sm border focus:outline-none focus:ring-2 cursor-pointer transition-colors focus:ring-opacity-50"
                        style={{ backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }}
                    >
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                        <option value="rating-high">Highest Rated</option>
                        <option value="rating-low">Lowest Rated</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-[#fcaab8] transition-colors">
                        <ChevronDown size={20} />
                    </div>
                </div>
            </div>

            <motion.div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto"
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
                            whileHover={{ y: -5, scale: 1.02, transition: { duration: 0.2 } }}
                            className="rounded-[2.5rem] overflow-hidden relative group transition-all flex flex-col h-72 neumorphic-glass"
                            style={{ backgroundColor: theme.surface, color: theme.text }}
                        >
                            {/* Visual Thumbnail graphic */}
                            <div className="h-40 bg-gradient-to-br from-[#fdf2eb] to-[#fadcc7] w-full relative overflow-hidden flex items-center justify-center p-6 text-center">
                                {room.imageUrl && (
                                    <img src={room.imageUrl} alt={room.name} className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
                                )}
                                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

                                <h3 className="text-white font-black text-2xl tracking-tight z-10 leading-tight drop-shadow-md line-clamp-2">
                                    {room.name}
                                </h3>

                                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm transform group-hover:scale-110 transition-transform">
                                    <Star size={14} className="fill-[#fcaab8] text-[#fcaab8]" />
                                    <span className="text-xs font-black text-gray-800">{averageRating}</span>
                                </div>
                            </div>

                            <div className="p-6 flex flex-col flex-1 transform transition-transform">
                                <p className="text-sm font-medium line-clamp-2 flex-1 leading-snug" style={{ color: theme.text, opacity: 0.8 }}>
                                    {room.description || 'Step inside to explore this curated 3D collection.'}
                                </p>

                                <div className="flex justify-between items-center mt-4 border-t border-gray-100 pt-4">
                                    <div
                                        className="flex items-center gap-2 cursor-pointer group/creator"
                                        onClick={(e) => { e.stopPropagation(); navigate(`/profile/${room.userId}`); }}
                                    >
                                        <img
                                            src={userProfiles[room.userId]?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${room.userId}`}
                                            alt="Creator"
                                            className="w-10 h-10 rounded-full bg-gray-100 object-cover border-2 border-transparent group-hover/creator:border-[#fcaab8] transition-all hover:scale-110"
                                            title={userProfiles[room.userId]?.displayName || 'Creator'}
                                        />
                                    </div>

                                    <button
                                        onClick={() => navigate(`/gallery/${room.id}`)}
                                        className="text-xs font-bold px-4 py-1.5 rounded-full transition-colors shadow-sm"
                                        style={{ backgroundColor: theme.primary, color: getContrastColor(theme.primary) }}
                                    >
                                        Enter Room
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </motion.div>
        </div>
    );
}
