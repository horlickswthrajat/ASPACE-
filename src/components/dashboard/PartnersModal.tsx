import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserMinus, Loader2, Users } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useAuth, type UserProfile } from '../../context/AuthContext';
import { db } from '../../lib/firebase';
import { doc, getDoc, collection, query, onSnapshot, deleteDoc, updateDoc, increment } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

interface PartnersModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string; // The ID of the profile whose partners we are viewing
}

export default function PartnersModal({ isOpen, onClose, userId }: PartnersModalProps) {
    const { theme } = useAppContext();
    const { user, setProfile } = useAuth();
    const navigate = useNavigate();

    const [partners, setPartners] = useState<{ id: string, profile: UserProfile | null }[]>([]);
    const [loading, setLoading] = useState(true);

    const isOwnProfile = user?.uid === userId;

    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);

        const partnershipsRef = collection(db, 'partnerships');
        const q = query(partnershipsRef);

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const partnerIds: string[] = [];

            // Note: Since Firestore requires complex indexes for OR queries, we filter locally.
            // In a production app with huge lists, we would structure this differently.
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                if (data.status === 'accepted' && (data.user1 === userId || data.user2 === userId)) {
                    const otherId = data.user1 === userId ? data.user2 : data.user1;
                    partnerIds.push(otherId);
                }
            });

            // Fetch profiles for these IDs
            const fetchedPartners: { id: string, profile: UserProfile | null }[] = [];
            for (const pid of partnerIds) {
                try {
                    const userDoc = await getDoc(doc(db, 'users', pid));
                    fetchedPartners.push({
                        id: pid,
                        profile: userDoc.exists() ? (userDoc.data() as UserProfile) : null
                    });
                } catch (e) {
                    console.error("Error fetching partner profile", e);
                }
            }

            setPartners(fetchedPartners);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isOpen, userId]);

    const handleRemovePartner = async (partnerId: string) => {
        if (!user || !isOwnProfile) return;

        if (!window.confirm("Are you sure you want to remove this partner?")) return;

        const partnershipId = [user.uid, partnerId].sort().join('_');

        try {
            // Delete partnership document
            await deleteDoc(doc(db, 'partnerships', partnershipId));

            // Decrement counts globally
            await updateDoc(doc(db, 'users', user.uid), { partnersCount: increment(-1) });
            await updateDoc(doc(db, 'users', partnerId), { partnersCount: increment(-1) });

            // Update local profile state optimistically
            setProfile(prev => prev ? { ...prev, partnersCount: Math.max(0, (prev.partnersCount || 1) - 1) } : prev);
        } catch (error) {
            console.error("Error removing partner:", error);
            alert("Failed to remove partner.");
        }
    };

    const handlePartnerClick = (partnerId: string) => {
        onClose();
        navigate(`/artist/${partnerId}`);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]"
                        style={{ backgroundColor: theme.surface, border: `1px solid ${theme.border}` }}
                    >
                        {/* Header */}
                        <div className="px-6 py-5 border-b flex justify-between items-center" style={{ borderColor: theme.border }}>
                            <div className="flex items-center gap-3">
                                <Users size={24} style={{ color: theme.primary }} />
                                <h2 className="text-xl font-bold tracking-tight" style={{ color: theme.text }}>
                                    {isOwnProfile ? 'Your Partners' : 'Partners'}
                                </h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-full hover:bg-black/5 transition-colors"
                            >
                                <X size={20} style={{ color: theme.text }} />
                            </button>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar min-h-[300px]">
                            {loading ? (
                                <div className="flex justify-center items-center h-full min-h-[200px]">
                                    <Loader2 className="animate-spin" size={32} style={{ color: theme.primary }} />
                                </div>
                            ) : partners.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-8 h-full opacity-50 text-center gap-3 min-h-[200px]">
                                    <Users size={48} />
                                    <p className="font-bold" style={{ color: theme.text }}>No partners yet.</p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-1 p-2">
                                    {partners.map((p) => {
                                        const pName = p.profile?.displayName || 'Anonymous Artist';
                                        const pPhoto = p.profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.id}`;

                                        return (
                                            <div
                                                key={p.id}
                                                onClick={() => handlePartnerClick(p.id)}
                                                className="flex items-center justify-between p-3 rounded-2xl hover:bg-black/5 transition-colors cursor-pointer group"
                                            >
                                                <div className="flex items-center gap-4 min-w-0">
                                                    <img
                                                        src={pPhoto}
                                                        alt={pName}
                                                        className="w-12 h-12 rounded-full object-cover border-2 bg-white flex-shrink-0"
                                                        style={{ borderColor: theme.primary }}
                                                    />
                                                    <div className="truncate">
                                                        <h3 className="font-bold text-base truncate" style={{ color: theme.text }}>
                                                            {pName}
                                                        </h3>
                                                        <p className="text-xs font-semibold opacity-60 truncate" style={{ color: theme.text }}>
                                                            {p.profile?.bio || 'No bio'}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Remove Button (Only for own profile) */}
                                                {isOwnProfile && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRemovePartner(p.id);
                                                        }}
                                                        className="p-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-full opacity-0 group-hover:opacity-100 transition-all focus:opacity-100 ml-2"
                                                        title="Remove Partner"
                                                    >
                                                        <UserMinus size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
