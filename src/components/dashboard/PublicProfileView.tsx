import { useState, useEffect } from 'react';
import { motion, type Variants } from 'framer-motion';
import { ArrowLeft, Loader2, Image as ImageIcon } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useAuth, type UserProfile } from '../../context/AuthContext';
import { getContrastColor } from '../../utils/colorUtils';
import { db } from '../../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, setDoc, deleteDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import PartnersModal from './PartnersModal';

interface PublicProfileViewProps {
    userId: string;
    onBack: () => void;
    onMessage: () => void;
    containerVariants: Variants;
    itemVariants: Variants;
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

export default function PublicProfileView({ userId, onBack, onMessage, containerVariants, itemVariants }: PublicProfileViewProps) {
    const { theme } = useAppContext();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [rooms, setRooms] = useState<UserRoom[]>([]);
    const [loading, setLoading] = useState(true);

    type PartnerStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted';
    const [partnerStatus, setPartnerStatus] = useState<PartnerStatus>('none');
    const [togglingPartner, setTogglingPartner] = useState(false);
    const [isPartnersModalOpen, setIsPartnersModalOpen] = useState(false);

    useEffect(() => {
        const fetchProfileAndArtworks = async () => {
            if (!userId) return;

            try {
                // Fetch User Profile
                const userDocRef = doc(db, 'users', userId);
                const userDoc = await getDoc(userDocRef);

                if (userDoc.exists()) {
                    setProfile(userDoc.data() as UserProfile);
                }

                // Fetch User Rooms
                const q = query(collection(db, 'rooms'), where('userId', '==', userId));
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

                // Sort newest first
                fetchedRooms.sort((a, b) => {
                    if (!a.createdAt || !b.createdAt) return 0;
                    return b.createdAt.getTime() - a.createdAt.getTime();
                });

                setRooms(fetchedRooms);

                // Check Partner Status
                if (user && user.uid !== userId) {
                    const partnershipId = [user.uid, userId].sort().join('_');
                    const partnershipDoc = await getDoc(doc(db, 'partnerships', partnershipId));
                    if (partnershipDoc.exists()) {
                        const data = partnershipDoc.data();
                        if (data.status === 'accepted') {
                            setPartnerStatus('accepted');
                        } else if (data.status === 'pending') {
                            setPartnerStatus(data.requesterId === user.uid ? 'pending_sent' : 'pending_received');
                        }
                    } else {
                        setPartnerStatus('none');
                    }
                }

            } catch (error) {
                console.error("Error fetching public profile:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchProfileAndArtworks();
    }, [userId, user]);

    const getPartnershipId = () => {
        if (!user) return '';
        return [user.uid, userId].sort().join('_');
    };

    const handleRequestPartner = async () => {
        if (!user || togglingPartner) return;
        setTogglingPartner(true);
        const partnershipId = getPartnershipId();
        const partnershipRef = doc(db, 'partnerships', partnershipId);

        try {
            await setDoc(partnershipRef, {
                user1: user.uid,
                user2: userId,
                status: 'pending',
                requesterId: user.uid,
                createdAt: serverTimestamp()
            });

            // Send Notification (Deterministic ID to prevent duplicates)
            const notifId = `req_${user.uid}_${userId}`;
            await setDoc(doc(db, 'notifications', notifId), {
                ownerId: userId,
                actorId: user.uid,
                actorName: user.displayName || 'Someone',
                actorPhoto: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
                type: 'partner_request',
                message: 'sent you a partner request.',
                contextId: user.uid,
                contextImage: null,
                createdAt: serverTimestamp(),
                read: false
            });

            setPartnerStatus('pending_sent');
        } catch (error) {
            console.error("Error requesting partner:", error);
            alert("Failed to send partner request.");
        } finally {
            setTogglingPartner(false);
        }
    };

    const handleAcceptPartner = async () => {
        if (!user || togglingPartner) return;
        setTogglingPartner(true);
        const partnershipId = getPartnershipId();
        const partnershipRef = doc(db, 'partnerships', partnershipId);
        const currentUserRef = doc(db, 'users', user.uid);
        const targetUserRef = doc(db, 'users', userId);

        try {
            const pDoc = await getDoc(partnershipRef);
            const isAlreadyAccepted = pDoc.exists() && pDoc.data().status === 'accepted';

            await updateDoc(partnershipRef, {
                status: 'accepted',
                updatedAt: serverTimestamp()
            });

            if (!isAlreadyAccepted) {
                await updateDoc(currentUserRef, { partnersCount: increment(1) });
                await updateDoc(targetUserRef, { partnersCount: increment(1) });
                setProfile(prev => prev ? { ...prev, partnersCount: (prev.partnersCount || 0) + 1 } : prev);
            }
            setPartnerStatus('accepted');

            // Send accepted notification
            await setDoc(doc(collection(db, 'notifications')), {
                ownerId: userId,
                actorId: user.uid,
                actorName: user.displayName || 'Someone',
                actorPhoto: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
                type: 'partner_accepted',
                message: 'accepted your partner request.',
                contextId: user.uid,
                contextImage: null,
                createdAt: serverTimestamp(),
                read: false
            });

        } catch (error) {
            console.error("Error accepting partner:", error);
            alert("Failed to accept partner request.");
        } finally {
            setTogglingPartner(false);
        }
    };

    const handleRejectPartner = async () => {
        if (!user || togglingPartner) return;
        setTogglingPartner(true);
        const partnershipId = getPartnershipId();
        const partnershipRef = doc(db, 'partnerships', partnershipId);

        try {
            await deleteDoc(partnershipRef);
            setPartnerStatus('none');
        } catch (error) {
            console.error("Error rejecting partner:", error);
            alert("Failed to reject partner request.");
        } finally {
            setTogglingPartner(false);
        }
    };

    const handleRemovePartner = async () => {
        if (!user || togglingPartner) return;
        setTogglingPartner(true);
        const partnershipId = getPartnershipId();
        const partnershipRef = doc(db, 'partnerships', partnershipId);
        const currentUserRef = doc(db, 'users', user.uid);
        const targetUserRef = doc(db, 'users', userId);

        try {
            const pDoc = await getDoc(partnershipRef);
            const wasAccepted = pDoc.exists() && pDoc.data().status === 'accepted';

            await deleteDoc(partnershipRef);

            if (wasAccepted) {
                await updateDoc(currentUserRef, { partnersCount: increment(-1) });
                await updateDoc(targetUserRef, { partnersCount: increment(-1) });
                setProfile(prev => prev ? { ...prev, partnersCount: Math.max(0, (prev.partnersCount || 1) - 1) } : prev);
            }
            setPartnerStatus('none');
        } catch (error) {
            console.error("Error removing partner:", error);
            alert("Failed to remove partner.");
        } finally {
            setTogglingPartner(false);
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center">
                <Loader2 className="animate-spin mb-4" size={48} style={{ color: theme.primary }} />
                <p className="text-xl font-bold" style={{ color: theme.text }}>Loading profile...</p>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center">
                <h3 className="text-2xl font-bold" style={{ color: theme.text }}>Profile not found</h3>
                <button
                    onClick={onBack}
                    className="mt-6 px-6 py-3 rounded-full font-bold shadow-md hover:scale-105 transition-transform"
                    style={{ backgroundColor: theme.primary, color: theme.background }}
                >
                    Back to Artists
                </button>
            </div>
        );
    }

    const displayName = profile.displayName || 'Anonymous Artist';
    const avatarUrl = profile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.uid}`;
    const emailPrefix = profile.email ? profile.email.split('@')[0] : displayName.toLowerCase().replace(/\s+/g, '');

    return (
        <motion.div
            className="flex-1 overflow-y-auto px-10 pb-12 pt-4 max-w-5xl mx-auto w-full custom-scrollbar"
            variants={containerVariants}
            initial="hidden"
            animate="show"
        >
            {/* Top Actions */}
            <motion.div variants={itemVariants} className="flex items-center justify-between mb-6">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 font-bold hover:opacity-70 transition-opacity"
                    style={{ color: theme.text }}
                >
                    <ArrowLeft size={20} />
                    Back to Artists
                </button>
                <div className="flex items-center gap-3">
                    {user && user.uid !== userId && (
                        <div className="flex gap-2">
                            {partnerStatus === 'none' && (
                                <button
                                    onClick={handleRequestPartner}
                                    disabled={togglingPartner}
                                    className="px-6 py-2 border-2 rounded-full font-bold shadow-sm hover:scale-105 transition-all outline-none disabled:opacity-50"
                                    style={{ borderColor: theme.primary, color: theme.primary }}
                                >
                                    {togglingPartner ? <Loader2 size={16} className="animate-spin" /> : 'Request Partner'}
                                </button>
                            )}
                            {partnerStatus === 'pending_sent' && (
                                <button
                                    onClick={handleRejectPartner} // Allow canceling
                                    disabled={togglingPartner}
                                    className="px-6 py-2 bg-gray-200 border-2 border-transparent text-gray-500 rounded-full font-bold shadow-sm hover:scale-105 transition-all outline-none disabled:opacity-50"
                                >
                                    {togglingPartner ? <Loader2 size={16} className="animate-spin" /> : 'Request Sent'}
                                </button>
                            )}
                            {partnerStatus === 'pending_received' && (
                                <>
                                    <button
                                        onClick={handleAcceptPartner}
                                        disabled={togglingPartner}
                                        className="px-6 py-2 bg-green-500 border-2 border-transparent text-white rounded-full font-bold shadow-sm hover:scale-105 transition-all outline-none disabled:opacity-50"
                                    >
                                        Accept Request
                                    </button>
                                    <button
                                        onClick={handleRejectPartner}
                                        disabled={togglingPartner}
                                        className="px-6 py-2 bg-red-500 border-2 border-transparent text-white rounded-full font-bold shadow-sm hover:scale-105 transition-all outline-none disabled:opacity-50"
                                    >
                                        Reject
                                    </button>
                                </>
                            )}
                            {partnerStatus === 'accepted' && (
                                <button
                                    onClick={handleRemovePartner}
                                    disabled={togglingPartner}
                                    className="px-6 py-2 bg-transparent border-2 rounded-full font-bold shadow-sm hover:scale-105 transition-all outline-none disabled:opacity-50"
                                    style={{ borderColor: theme.primary, color: theme.primary }}
                                >
                                    {togglingPartner ? <Loader2 size={16} className="animate-spin text-current" /> : 'Remove Partner'}
                                </button>
                            )}
                        </div>
                    )}
                    <button
                        onClick={onMessage}
                        className="px-6 py-2 rounded-full font-bold shadow-sm hover:scale-105 transition-transform"
                        style={{ backgroundColor: theme.primary, color: theme.background }}
                    >
                        Message Artist
                    </button>
                </div>
            </motion.div>

            {/* Banner */}
            <motion.div
                variants={itemVariants}
                className="w-full h-48 rounded-[2rem] relative shadow-inner overflow-hidden"
                style={{ backgroundColor: `${theme.primary}B3` }}
            >
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            </motion.div>

            {/* Profile Info (Overlapping Banner) */}
            <motion.div variants={itemVariants} className="flex flex-col items-center -mt-20 relative px-8">
                <div
                    className="w-32 h-32 rounded-full overflow-hidden border-4 shadow-xl mb-4 relative z-10"
                    style={{ borderColor: theme.surface, backgroundColor: theme.primary }}
                >
                    <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                </div>

                <div className="flex w-full justify-center items-start pt-2">
                    <div className="text-center w-full max-w-2xl flex flex-col items-center">
                        <h1 className="text-3xl font-black tracking-wide mb-1" style={{ color: theme.text }}>{displayName}</h1>
                        <p className="font-semibold opacity-60 mb-6" style={{ color: theme.text }}>
                            @{emailPrefix}
                        </p>

                        {/* Bio */}
                        {profile.bio && (
                            <p className="text-lg font-medium opacity-90 leading-relaxed max-w-xl text-center mb-6" style={{ color: theme.text }}>
                                "{profile.bio}"
                            </p>
                        )}

                        {/* Art Styles */}
                        {profile.artStyles && profile.artStyles.length > 0 && (
                            <div className="flex flex-wrap justify-center gap-2 mb-8">
                                {profile.artStyles.map(style => (
                                    <span
                                        key={style}
                                        className="px-4 py-1.5 rounded-full text-sm font-bold shadow-sm"
                                        style={{ backgroundColor: `${theme.primary}20`, color: theme.primary, border: `1px solid ${theme.primary}40` }}
                                    >
                                        {style}
                                    </span>
                                ))}
                            </div>
                        )}

                        <div className="flex items-center justify-center gap-12 mt-2 w-full max-w-md mx-auto py-6 border-y" style={{ borderColor: `${theme.text}20` }}>
                            <button
                                onClick={() => setIsPartnersModalOpen(true)}
                                className="text-center group p-2 rounded-xl transition-colors hover:bg-black/5 flex flex-col items-center"
                            >
                                <p className="font-black text-2xl transition-transform group-hover:scale-105" style={{ color: theme.text }}>{profile.partnersCount || 0}</p>
                                <p className="text-sm font-bold opacity-50 uppercase tracking-widest mt-1 group-hover:opacity-100 transition-opacity" style={{ color: theme.text }}>Partners</p>
                            </button>
                            <div className="w-px h-12" style={{ backgroundColor: `${theme.text}20` }} />
                            <div className="text-center">
                                <p className="font-black text-2xl" style={{ color: theme.text }}>{rooms.length}</p>
                                <p className="text-sm font-bold opacity-50 uppercase tracking-widest mt-1" style={{ color: theme.text }}>Rooms</p>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Uploaded Rooms Grid */}
            <motion.div variants={itemVariants} className="mt-16">
                <div className="flex items-center gap-3 mb-8">
                    <ImageIcon size={28} style={{ color: theme.primary }} />
                    <h2 className="text-3xl font-black tracking-tight" style={{ color: theme.text }}>Rooms</h2>
                </div>

                {rooms.length === 0 ? (
                    <div className="text-center p-16 rounded-[2rem] border-2 border-dashed" style={{ borderColor: `${theme.text}20` }}>
                        <p className="opacity-60 font-bold text-lg" style={{ color: theme.text }}>
                            This artist hasn't created any rooms yet.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-4">
                        {rooms.map((room) => {
                            const averageRating = room.ratingCount > 0 ? (room.ratingSum / room.ratingCount).toFixed(1) : 'New';
                            return (
                                <motion.div
                                    key={room.id}
                                    className="rounded-[2rem] overflow-hidden relative group shadow-sm border border-transparent transition-all flex flex-col h-64"
                                    whileHover={{ scale: 1.03, y: -5, transition: { duration: 0.2 }, borderColor: theme.primary }}
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
                                    <div className="p-5 flex flex-col flex-1">
                                        <p className="text-sm font-medium line-clamp-2 flex-1" style={{ color: theme.text }}>{room.description || 'Step inside to explore this curated 3D collection.'}</p>
                                        <div className="flex justify-between items-center mt-4">
                                            <button
                                                onClick={() => navigate(`/gallery/${room.id}`)}
                                                className="text-xs font-bold px-4 py-2 rounded-full transition-colors"
                                                style={{ backgroundColor: theme.primary, color: getContrastColor(theme.primary) }}
                                            >
                                                Enter Room
                                            </button>
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

            {isPartnersModalOpen && (
                <PartnersModal
                    isOpen={isPartnersModalOpen}
                    onClose={() => setIsPartnersModalOpen(false)}
                    userId={userId}
                />
            )}
        </motion.div>
    );
}
