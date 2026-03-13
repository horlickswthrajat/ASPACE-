import { useState, useEffect } from 'react';
import { motion, type Variants } from 'framer-motion';
import { db } from '../../lib/firebase';
import { collection, getDocs, orderBy, query, doc, serverTimestamp, setDoc, onSnapshot } from 'firebase/firestore';
import { Users, Loader2 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useAuth, type UserProfile } from '../../context/AuthContext';
import { getContrastColor } from '../../utils/colorUtils';

interface ArtistsViewProps {
    containerVariants: Variants;
    itemVariants: Variants;
    onArtistClick: (userId: string) => void;
}

const AVAILABLE_ART_STYLES = [
    'All', 'Baroque', 'Rococo', 'Neoclassical', 'Romantic', 'Realism',
    'Impressionism', 'Cubism', 'Expressionism', 'Abstract Expressionism',
    'Dada', 'Surrealism', 'Anime', 'Digital', 'Minimalism', 'Pop Art'
];

export default function ArtistsView({ containerVariants, itemVariants, onArtistClick }: ArtistsViewProps) {
    const { theme } = useAppContext();
    const { user, profile } = useAuth();
    const [artists, setArtists] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<string>('All');

    // Partnership State mapping userId -> status
    type PartnerStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted';
    const [partnerships, setPartnerships] = useState<Record<string, PartnerStatus>>({});
    const [actingUserId, setActingUserId] = useState<string | null>(null);

    useEffect(() => {
        const fetchArtists = async () => {
            try {
                // Fetch all users sorted by most recently created
                const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
                const querySnapshot = await getDocs(q);

                const fetchedArtists: UserProfile[] = [];
                querySnapshot.forEach((doc) => {
                    // Make sure we don't crash if malformed data exists
                    const data = doc.data() as UserProfile;
                    if (data.uid) {
                        fetchedArtists.push(data);
                    }
                });

                setArtists(fetchedArtists);
            } catch (error) {
                console.error("Error fetching artists:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchArtists();
    }, []);

    // Fetch partnerships
    useEffect(() => {
        if (!user) return;

        // Note: Firestore doesn't easily support OR queries across different array elements in a simple way without 'in' queries,
        // so we fetch all partnerships and filter locally for simplicity, given this is an MVP.
        const q = query(collection(db, 'partnerships'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newPartnerships: Record<string, PartnerStatus> = {};
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                if (data.user1 === user.uid || data.user2 === user.uid) {
                    const otherId = data.user1 === user.uid ? data.user2 : data.user1;
                    if (data.status === 'accepted') {
                        newPartnerships[otherId] = 'accepted';
                    } else if (data.status === 'pending') {
                        newPartnerships[otherId] = data.requesterId === user.uid ? 'pending_sent' : 'pending_received';
                    }
                }
            });
            setPartnerships(newPartnerships);
        });

        return () => unsubscribe();
    }, [user]);

    const handleRequestPartner = async (targetUserId: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Don't trigger the card click (which opens profile)
        if (!user || actingUserId) return;
        setActingUserId(targetUserId);

        const partnershipId = [user.uid, targetUserId].sort().join('_');
        const partnershipRef = doc(db, 'partnerships', partnershipId);

        try {
            await setDoc(partnershipRef, {
                user1: user.uid,
                user2: targetUserId,
                status: 'pending',
                requesterId: user.uid,
                createdAt: serverTimestamp()
            });

            // Send Notification
            await setDoc(doc(collection(db, 'notifications')), {
                ownerId: targetUserId,
                actorId: user.uid,
                actorName: profile?.displayName || 'Someone',
                actorPhoto: profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
                type: 'partner_request',
                message: 'sent you a partner request.',
                contextId: user.uid,
                contextImage: null,
                createdAt: serverTimestamp(),
                read: false
            });

            // State updates automatically via onSnapshot Listener
        } catch (error) {
            console.error("Error requesting partner:", error);
            alert("Failed to send partner request.");
        } finally {
            setActingUserId(null);
        }
    };

    return (
        <motion.div
            className="flex-1 overflow-y-auto pr-4 mr-4 mt-4 relative z-10 custom-scrollbar pb-24"
            variants={containerVariants}
            initial="hidden"
            animate="show"
        >
            <motion.div variants={itemVariants} className="mb-8 pl-4 flex items-center gap-4">
                <div className="p-3 rounded-2xl shadow-sm border" style={{ backgroundColor: theme.surface, borderColor: theme.border }}>
                    <Users size={32} style={{ color: theme.primary }} />
                </div>
                <div>
                    <h2 className="text-4xl font-black tracking-tight" style={{ color: theme.text }}>Artists</h2>
                    <p className="font-semibold opacity-70 mt-1" style={{ color: theme.text }}>
                        Discover creators across ArtSpace
                    </p>
                </div>
            </motion.div>

            {/* Categories filter */}
            <motion.div variants={itemVariants} className="mb-8 pl-4 pr-4">
                <div className="flex gap-3 overflow-x-auto pb-4 pt-1 custom-scrollbar hide-scrollbar-on-mobile">
                    {AVAILABLE_ART_STYLES.map(style => {
                        const isSelected = selectedCategory === style;
                        return (
                            <button
                                key={style}
                                onClick={() => setSelectedCategory(style)}
                                className={`whitespace-nowrap px-6 py-2.5 rounded-full font-bold transition-all shadow-sm flex-shrink-0 ${isSelected
                                    ? 'scale-105 shadow-md'
                                    : 'hover:brightness-110 hover:scale-105 opacity-80 hover:opacity-100'
                                    }`}
                                style={{
                                    backgroundColor: isSelected ? theme.primary : theme.surface,
                                    color: isSelected ? getContrastColor(theme.primary) : theme.text,
                                    border: `1px solid ${isSelected ? theme.primary : theme.border}`
                                }}
                            >
                                {style}
                            </button>
                        );
                    })}
                </div>
            </motion.div>

            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center mt-32">
                    <Loader2 className="animate-spin mb-4" size={48} style={{ color: theme.primary }} />
                    <p className="text-xl font-bold" style={{ color: theme.text }}>Loading artists...</p>
                </div>
            ) : artists.length === 0 ? (
                <div
                    className="w-full h-64 rounded-[2.5rem] border shadow-sm flex flex-col items-center justify-center p-12 text-center backdrop-blur-sm"
                    style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                >
                    <Users size={48} className="mb-4 opacity-30" style={{ color: theme.text }} />
                    <h3 className="text-2xl font-bold mb-2" style={{ color: theme.text }}>No artists found</h3>
                    <p className="font-semibold opacity-70" style={{ color: theme.text }}>
                        There are no registered users yet. Invite some friends!
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-4">
                    {artists.filter(artist => {
                        if (selectedCategory === 'All') return true;
                        return artist.artStyles?.includes(selectedCategory);
                    }).map((artist) => (
                        <motion.div
                            key={artist.uid}
                            variants={itemVariants}
                            whileHover={{ y: -8, scale: 1.02 }}
                            className="rounded-[2rem] p-6 shadow-sm hover:shadow-xl transition-all border backdrop-blur-xl flex flex-col items-center text-center cursor-pointer group"
                            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                        >
                            {/* Avatar Container */}
                            <div className="relative mb-5">
                                <div
                                    className="w-28 h-28 rounded-full flex items-center justify-center bg-gray-100 shadow-inner overflow-hidden border-4 z-10 relative group-hover:border-transparent transition-colors duration-300"
                                    style={{ backgroundColor: `${theme.primary}20`, borderColor: theme.border }}
                                >
                                    <img
                                        src={artist.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${artist.uid}`}
                                        alt={artist.displayName || 'Artist'}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                {/* Glow Effect behind avatar */}
                                <div
                                    className="absolute inset-0 rounded-full blur-xl opacity-0 group-hover:opacity-40 transition-opacity duration-300"
                                    style={{ backgroundColor: theme.primary, transform: 'scale(1.2)' }}
                                />
                            </div>

                            <h3 className="text-xl font-bold tracking-tight mb-1 truncate w-full px-2" style={{ color: theme.text }}>
                                {artist.displayName || 'Anonymous Artist'}
                            </h3>

                            <p className="text-sm font-semibold opacity-60 line-clamp-2 mb-4 h-10 px-2" style={{ color: theme.text }}>
                                {artist.bio || "No bio provided yet."}
                            </p>

                            <div className="flex justify-center items-center mt-auto w-full pt-4 border-t border-gray-100/50">
                                <div className="flex flex-col items-center">
                                    <span className="text-lg font-black tracking-tight" style={{ color: theme.text }}>
                                        {artist.partnersCount || 0}
                                    </span>
                                    <span className="text-xs font-bold opacity-50 uppercase tracking-wider" style={{ color: theme.text }}>
                                        Partners
                                    </span>
                                </div>
                            </div>

                            {/* Action Buttons (Hover State Only) */}
                            <div className="absolute inset-x-4 bottom-4 opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-300 flex flex-col gap-2">
                                <button
                                    onClick={() => onArtistClick(artist.uid)}
                                    className="w-full py-2.5 rounded-xl font-bold shadow-lg transition-transform hover:scale-105"
                                    style={{ backgroundColor: theme.primary, color: getContrastColor(theme.primary) }}
                                >
                                    View Profile
                                </button>

                                {user && user.uid !== artist.uid && (
                                    <div className="w-full transition-transform hover:scale-105 shadow-lg rounded-xl overflow-hidden">
                                        {(!partnerships[artist.uid] || partnerships[artist.uid] === 'none') && (
                                            <button
                                                onClick={(e) => handleRequestPartner(artist.uid, e)}
                                                disabled={actingUserId === artist.uid}
                                                className="w-full py-2.5 font-bold shadow-sm transition-colors text-white outline-none active:scale-95 flex items-center justify-center gap-2"
                                                style={{ backgroundColor: '#2dd4bf' }} // Teal-ish color for differentiation
                                            >
                                                {actingUserId === artist.uid ? <Loader2 size={16} className="animate-spin" /> : 'Request Partner'}
                                            </button>
                                        )}
                                        {partnerships[artist.uid] === 'pending_sent' && (
                                            <button
                                                className="w-full py-2.5 font-bold bg-gray-200 text-gray-500 cursor-default opacity-80 backdrop-blur-md"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                Request Sent
                                            </button>
                                        )}
                                        {partnerships[artist.uid] === 'pending_received' && (
                                            <button
                                                className="w-full py-2.5 font-bold bg-indigo-500 text-white cursor-pointer hover:bg-indigo-600 transition-colors"
                                                onClick={(e) => { e.stopPropagation(); onArtistClick(artist.uid); }}
                                            >
                                                Accept Request
                                            </button>
                                        )}
                                        {partnerships[artist.uid] === 'accepted' && (
                                            <button
                                                className="w-full py-2.5 font-bold bg-transparent border-2 border-white/50 text-white cursor-default backdrop-blur-md"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                Partner
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </motion.div>
    );
}
