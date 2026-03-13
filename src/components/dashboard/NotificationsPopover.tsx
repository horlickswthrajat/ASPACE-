import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, X } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, updateDoc, limit, doc, setDoc, deleteDoc, increment, serverTimestamp, getDoc } from 'firebase/firestore';

interface NotificationsPopoverProps {
    isOpen: boolean;
    onClose: () => void;
}

interface AppNotification {
    id: string;
    actorId: string;
    actorName: string;
    actorPhoto: string;
    type: string;
    message: string;
    contextImage: string | null;
    read: boolean;
    createdAt: Date | null;
}

export default function NotificationsPopover({ isOpen, onClose }: NotificationsPopoverProps) {
    const { theme } = useAppContext();
    const { user, setProfile } = useAuth();
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [animatingAcceptId, setAnimatingAcceptId] = useState<string | null>(null);

    useEffect(() => {
        if (!user || !isOpen) return;

        const q = query(
            collection(db, 'notifications'),
            where('ownerId', '==', user.uid),
            orderBy('createdAt', 'desc'),
            limit(30)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notifs = snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                actorId: docSnap.data().actorId,
                actorName: docSnap.data().actorName,
                actorPhoto: docSnap.data().actorPhoto,
                type: docSnap.data().type,
                message: docSnap.data().message,
                contextImage: docSnap.data().contextImage,
                read: docSnap.data().read,
                createdAt: docSnap.data().createdAt?.toDate() || null
            }));
            setNotifications(notifs);

            // Mark unread notifications as read when the popover is opened
            snapshot.docs.forEach(docSnap => {
                if (!docSnap.data().read) {
                    updateDoc(docSnap.ref, { read: true });
                }
            });
        });

        return () => unsubscribe();
    }, [user, isOpen]);

    const handleAcceptPartner = async (notif: AppNotification) => {
        if (!user) return;
        const actorId = notif.actorId;
        const notificationId = notif.id;

        setAnimatingAcceptId(notificationId);

        const partnershipId = [user.uid, actorId].sort().join('_');
        const partnershipRef = doc(db, 'partnerships', partnershipId);

        try {
            const pDoc = await getDoc(partnershipRef);
            const isAlreadyAccepted = pDoc.exists() && pDoc.data().status === 'accepted';

            await updateDoc(partnershipRef, {
                status: 'accepted',
                updatedAt: serverTimestamp()
            });

            if (!isAlreadyAccepted) {
                // Update partner counts
                const currentUserRef = doc(db, 'users', user.uid);
                const targetUserRef = doc(db, 'users', actorId);
                await updateDoc(currentUserRef, { partnersCount: increment(1) });
                await updateDoc(targetUserRef, { partnersCount: increment(1) });

                // Optimistic UI update
                setProfile(prev => prev ? { ...prev, partnersCount: (prev.partnersCount || 0) + 1 } : prev);
            }

            // Send acceptance notification to the other user
            await setDoc(doc(collection(db, 'notifications')), {
                ownerId: actorId,
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

            // Play animation then transform notification to success state
            setTimeout(async () => {
                try {
                    await updateDoc(doc(db, 'notifications', notificationId), {
                        type: 'partner_success',
                        message: ``, // Message handled in UI
                        read: true
                    });
                } catch (e) {
                    console.error("Error updating notification type", e);
                } finally {
                    setAnimatingAcceptId(null);
                }
            }, 1500);

        } catch (error) {
            console.error("Error accepting partner:", error);
            alert("Failed to accept partner request.");
            setAnimatingAcceptId(null);
        }
    };

    const handleRejectPartner = async (notificationId: string, actorId: string) => {
        if (!user) return;
        const partnershipId = [user.uid, actorId].sort().join('_');
        const partnershipRef = doc(db, 'partnerships', partnershipId);

        try {
            await deleteDoc(partnershipRef);
            await deleteDoc(doc(db, 'notifications', notificationId));
        } catch (error) {
            console.error("Error rejecting partner:", error);
            alert("Failed to reject partner request.");
        }
    };

    const handleDeleteNotification = async (e: React.MouseEvent, notificationId: string) => {
        e.stopPropagation();
        try {
            await deleteDoc(doc(db, 'notifications', notificationId));
        } catch (error) {
            console.error("Error deleting notification:", error);
        }
    };

    // Simple relative time formatter
    const getRelativeTime = (date: Date | null) => {
        if (!date) return 'Just now';
        const diffInSeconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours} hours ago`;
        const diffInDays = Math.floor(diffInHours / 24);
        return `${diffInDays} days ago`;
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Invisible backdrop to catch clicks outside */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40"
                        onClick={onClose}
                    />

                    {/* Popover Content */}
                    <motion.div
                        initial={{ opacity: 0, x: -20, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -10, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="absolute left-[380px] top-6 w-[450px] max-h-[85vh] overflow-y-auto rounded-[2rem] shadow-2xl z-50 p-6 flex flex-col gap-6"
                        style={{ backgroundColor: theme.surface, color: theme.text, border: `1px solid ${theme.border}` }}
                    >
                        <h2 className="text-2xl font-bold tracking-tight">Notifications</h2>

                        <div className="flex flex-col gap-5">
                            {notifications.length === 0 ? (
                                <p className="text-center opacity-50 py-4">No recent notifications.</p>
                            ) : (
                                notifications.map((notif) => (
                                    <div key={notif.id} className="flex gap-4 items-start group">
                                        <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border-2" style={{ borderColor: theme.primary }}>
                                            <img src={notif.actorPhoto} alt="avatar" className="w-full h-full object-cover bg-gray-100" />
                                        </div>

                                        <div className="flex-1 pr-6 relative">
                                            <button
                                                onClick={(e) => handleDeleteNotification(e, notif.id)}
                                                className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                                                title="Delete Notification"
                                            >
                                                <X size={14} />
                                            </button>

                                            <p className="text-[15px] leading-snug pr-4">
                                                {notif.type === 'partner_success' || notif.type === 'partner_accepted' ? (
                                                    <>You are now partnered with <span className="font-bold">{notif.actorName}</span></>
                                                ) : (
                                                    <><span className="font-bold">{notif.actorName}</span> {notif.message}</>
                                                )}
                                            </p>
                                            <p className="text-sm mt-1 opacity-60 font-medium">{getRelativeTime(notif.createdAt)}</p>

                                            {notif.type === 'partner_request' && animatingAcceptId !== notif.id && (
                                                <div className="flex items-center gap-3 mt-3">
                                                    <button
                                                        onClick={() => handleAcceptPartner(notif)}
                                                        className="px-4 py-1.5 rounded-full text-sm font-bold shadow-sm transition-transform hover:scale-105 active:scale-95"
                                                        style={{ backgroundColor: theme.primary, color: theme.background }}
                                                    >
                                                        Accept
                                                    </button>
                                                    <button
                                                        onClick={() => handleRejectPartner(notif.id, notif.actorId)}
                                                        className="px-4 py-1.5 rounded-full text-sm font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                                                    >
                                                        Decline
                                                    </button>
                                                </div>
                                            )}

                                            {animatingAcceptId === notif.id && (
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.8 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    className="flex items-center gap-2 mt-3 text-green-500 font-bold text-sm"
                                                >
                                                    <CheckCircle2 size={16} /> Request Accepted!
                                                </motion.div>
                                            )}

                                            {notif.type === 'partner_success' && (
                                                <div className="flex items-center gap-2 mt-3 text-green-500 font-bold text-sm bg-green-50 py-1 px-3 rounded-full w-fit border border-green-200">
                                                    <CheckCircle2 size={16} /> Partners
                                                </div>
                                            )}
                                        </div>

                                        {notif.contextImage && (
                                            <div className="w-12 h-16 rounded-xl overflow-hidden flex-shrink-0 shadow-sm transition-transform group-hover:scale-105 cursor-pointer">
                                                <img src={notif.contextImage} alt="art" className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
