import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle, X, Loader2, Send, Pencil, Check } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/firebase';
import { doc, getDoc, setDoc, deleteDoc, updateDoc, increment, serverTimestamp, collection, query, where, orderBy, getDocs, addDoc } from 'firebase/firestore';

export default function ArtworkDetailsOverlay({ artwork, onClose }: { artwork: any | null, onClose: () => void }) {
    const { theme } = useAppContext();
    const { user, profile } = useAuth();

    const [isLiked, setIsLiked] = useState(false);
    const [likeCount, setLikeCount] = useState<number>(Number(artwork?.likesCount || artwork?.likes || 0));
    const [isLiking, setIsLiking] = useState(false);
    const [artistData, setArtistData] = useState<any>(null);

    // Comments State
    const [isCommentsOpen, setIsCommentsOpen] = useState(false);
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState("");
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [isLoadingComments, setIsLoadingComments] = useState(false);

    // Edit State
    const isOwner = user && artwork?.userId === user.uid;
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(artwork?.title || '');
    const [editDescription, setEditDescription] = useState(artwork?.description || '');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!artwork || !user) return;

        // Check if user has already liked this
        const checkLikeStatus = async () => {
            const likeDocRef = doc(db, 'likes', `${user.uid}_${artwork.id}`);
            const likeDoc = await getDoc(likeDocRef);
            if (likeDoc.exists()) {
                setIsLiked(true);
            }
        };

        // Fetch artist basic info (if we have userId)
        const fetchArtist = async () => {
            if (artwork.userId) {
                const artistRef = doc(db, 'users', artwork.userId);
                const artistSnap = await getDoc(artistRef);
                if (artistSnap.exists()) {
                    setArtistData(artistSnap.data());
                }
            }
        };

        checkLikeStatus();
        fetchArtist();
        setLikeCount(Number(artwork?.likesCount || artwork?.likes || 0));
    }, [artwork, user]);

    // Fetch comments
    useEffect(() => {
        if (!isCommentsOpen || !artwork) return;

        const fetchComments = async () => {
            setIsLoadingComments(true);
            try {
                const q = query(
                    collection(db, 'comments'),
                    where('artworkId', '==', artwork.id),
                    orderBy('createdAt', 'desc')
                );
                const snapshot = await getDocs(q);

                const fetchedComments = snapshot.docs.map(docSnap => ({
                    id: docSnap.id,
                    ...docSnap.data()
                }));

                setComments(fetchedComments);
            } catch (error) {
                console.error("Error fetching comments:", error);
            } finally {
                setIsLoadingComments(false);
            }
        };

        fetchComments();
    }, [isCommentsOpen, artwork]);

    const handleToggleLike = async () => {
        if (!user || !artwork || isLiking) return;

        setIsLiking(true);
        const likeRef = doc(db, 'likes', `${user.uid}_${artwork.id}`);
        const artworkRef = doc(db, 'artworks', artwork.id);

        try {
            if (isLiked) {
                // Unlike
                await deleteDoc(likeRef);
                await updateDoc(artworkRef, { likesCount: increment(-1) });
                setLikeCount((prev: number) => Math.max(0, prev - 1));
                setIsLiked(false);
            } else {
                // Like
                await setDoc(likeRef, {
                    userId: user.uid,
                    artworkId: artwork.id,
                    createdAt: serverTimestamp()
                });
                await updateDoc(artworkRef, { likesCount: increment(1) });
                setLikeCount((prev: number) => prev + 1);
                setIsLiked(true);

                // Notify Artist (if it's not the user themselves)
                if (artwork.userId && artwork.userId !== user.uid) {
                    await addDoc(collection(db, 'notifications'), {
                        ownerId: artwork.userId,
                        actorId: user.uid,
                        actorName: profile?.displayName || user.displayName || 'Someone',
                        actorPhoto: profile?.photoURL || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
                        type: 'like',
                        message: 'liked your artwork.',
                        contextId: artwork.id,
                        contextImage: artwork.imageUrl || null,
                        createdAt: serverTimestamp(),
                        read: false
                    });
                }
            }
        } catch (error) {
            console.error("Failed to toggle like:", error);
        } finally {
            setIsLiking(false);
        }
    };

    const handleAddComment = async (e: any) => {
        e.preventDefault();
        if (!newComment.trim() || !user || !artwork) return;

        setIsSubmittingComment(true);
        try {
            const commentData = {
                artworkId: artwork.id,
                userId: user.uid,
                userDisplayName: profile?.displayName || user.displayName || 'Anonymous',
                userPhotoURL: profile?.photoURL || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
                text: newComment.trim(),
                createdAt: serverTimestamp()
            };

            const docRef = await addDoc(collection(db, 'comments'), commentData);

            // Optimistically update local state
            setComments([{ id: docRef.id, ...commentData, createdAt: new Date() }, ...comments]);
            setNewComment("");

            // Increment comment count on artwork
            const artworkRef = doc(db, 'artworks', artwork.id);
            await updateDoc(artworkRef, { commentsCount: increment(1) });

            // Notify Artist (if it's not the user themselves)
            if (artwork.userId && artwork.userId !== user.uid) {
                await addDoc(collection(db, 'notifications'), {
                    ownerId: artwork.userId,
                    actorId: user.uid,
                    actorName: profile?.displayName || user.displayName || 'Someone',
                    actorPhoto: profile?.photoURL || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
                    type: 'comment',
                    message: `commented: "${commentData.text.length > 20 ? commentData.text.substring(0, 20) + '...' : commentData.text}"`,
                    contextId: artwork.id,
                    contextImage: artwork.imageUrl || null,
                    createdAt: serverTimestamp(),
                    read: false
                });
            }

        } catch (error) {
            console.error("Failed to add comment:", error);
        } finally {
            setIsSubmittingComment(false);
        }
    };

    const handleSaveEdits = async () => {
        if (!user || user.uid !== artwork.userId) return;
        setIsSaving(true);
        try {
            await updateDoc(doc(db, 'artworks', artwork.id), {
                title: editTitle.trim(),
                description: editDescription.trim()
            });
            // Update local artwork reference directly so it shows immediately
            artwork.title = editTitle.trim();
            artwork.description = editDescription.trim();
            setIsEditing(false);
        } catch (error) {
            console.error("Failed to save edits:", error);
        } finally {
            setIsSaving(false);
        }
    };

    if (!artwork) return null;

    const artistName = artistData?.displayName || 'Artist';
    const artistAvatar = artistData?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${artwork.userId}`;

    return (
        <motion.div
            className="fixed right-16 top-1/2 -translate-y-1/2 z-50 w-96 rounded-[2rem] p-6 shadow-2xl backdrop-blur-xl border-2 pointer-events-auto"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ type: "spring", bounce: 0.3 }}
            style={{ backgroundColor: `${theme.primary}E6`, color: theme.text, borderColor: theme.border }}
        >
            <button onClick={onClose} className="absolute top-4 right-4 opacity-50 hover:opacity-100 transition-opacity">
                <X size={20} />
            </button>

            <div className="flex justify-between items-start mb-4 pr-8">
                {!isEditing ? (
                    <div className="flex-1">
                        <h3 className={`text-2xl font-bold ${artwork.description ? 'mb-2' : ''}`}>{artwork.title || 'Untitled'}</h3>
                        {artwork.description && (
                            <p className="text-sm opacity-80 leading-relaxed whitespace-pre-line">{artwork.description}</p>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 w-full pr-4">
                        <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full bg-black/20 border-none rounded-lg px-3 py-2 mb-2 text-xl font-bold focus:outline-none focus:ring-2"
                            placeholder="Artwork Title"
                            style={{ color: theme.text }}
                        />
                        <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            className="w-full bg-black/20 border-none rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none"
                            placeholder="Artwork Description (Optional)"
                            rows={3}
                            style={{ color: theme.text }}
                        />
                    </div>
                )}

                {isOwner && (
                    <button
                        onClick={() => {
                            if (isEditing) handleSaveEdits();
                            else setIsEditing(true);
                        }}
                        disabled={isSaving}
                        className="p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                        {isSaving ? <Loader2 size={18} className="animate-spin" /> : isEditing ? <Check size={18} /> : <Pencil size={18} />}
                    </button>
                )}
            </div>

            <div className="flex items-center gap-3 mb-6 opacity-80">
                <img src={artistAvatar} alt="Artist" className="w-8 h-8 rounded-full border border-white/40 object-cover bg-white/50" />
                <span className="font-semibold text-sm">{artistName} <span className="font-normal opacity-70">artist</span></span>
            </div>

            <div className="flex flex-col gap-3">
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleToggleLike}
                    disabled={isLiking}
                    className="flex items-center justify-between px-5 py-4 rounded-2xl border transition-colors relative overflow-hidden group"
                    style={{
                        borderColor: isLiked ? '#f594a6' : theme.border,
                        backgroundColor: isLiked ? '#f594a633' : 'rgba(255,255,255,0.05)'
                    }}
                >
                    <div className="flex items-center gap-3 relative z-10">
                        {isLiking ? (
                            <Loader2 size={20} className="animate-spin text-[#f594a6]" />
                        ) : (
                            <Heart size={20} className="transition-colors" color={isLiked ? "#f594a6" : theme.text} fill={isLiked ? "#f594a6" : "transparent"} />
                        )}
                        <span className="font-semibold">{isLiked ? 'Liked' : 'Like'}</span>
                    </div>
                    <span className="text-sm font-bold relative z-10">{likeCount.toLocaleString()}</span>
                </motion.button>

                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setIsCommentsOpen(!isCommentsOpen)}
                    className="flex items-center gap-3 px-5 py-4 rounded-2xl border bg-white/5 transition-colors hover:bg-white/10"
                    style={{ borderColor: theme.border }}
                >
                    <MessageCircle size={20} />
                    <span className="font-semibold text-sm">{isCommentsOpen ? 'Close comments' : 'Open comment thread'}</span>
                </motion.button>

                <AnimatePresence>
                    {isCommentsOpen && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden flex flex-col gap-4 mt-2"
                        >
                            <form onSubmit={handleAddComment} className="flex gap-2 relative">
                                <input
                                    type="text"
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder="Add a comment..."
                                    className="w-full bg-black/20 border-none rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2"
                                    style={{ color: theme.text }}
                                />
                                <button
                                    type="submit"
                                    disabled={!newComment.trim() || isSubmittingComment}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-black/30 hover:bg-black/50 transition-colors disabled:opacity-50 text-white"
                                >
                                    {isSubmittingComment ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                </button>
                            </form>

                            <div className="flex flex-col gap-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                {isLoadingComments ? (
                                    <div className="flex justify-center p-4"><Loader2 className="animate-spin" size={24} /></div>
                                ) : comments.length === 0 ? (
                                    <div className="text-center text-sm opacity-50 p-2">No comments yet. Be the first!</div>
                                ) : (
                                    comments.map((c, idx) => (
                                        <div key={c.id || idx} className="flex gap-3 bg-black/10 p-3 rounded-xl">
                                            <img src={c.userPhotoURL} className="w-8 h-8 rounded-full object-cover bg-black/20" alt="Avatar" />
                                            <div className="flex-1">
                                                <div className="font-bold text-xs opacity-70 mb-1">{c.userDisplayName}</div>
                                                <div className="text-sm leading-tight break-words">{c.text}</div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onClose}
                    className="w-full mt-2 py-4 rounded-2xl font-bold transition-all shadow-md text-center border-2 border-transparent hover:border-[#fcaab8]"
                    style={{ backgroundColor: theme.text, color: theme.background }}
                >
                    Resume Exploring
                </motion.button>
            </div>
        </motion.div>
    );
}
