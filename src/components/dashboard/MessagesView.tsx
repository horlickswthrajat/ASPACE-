import { useState, useEffect, useRef } from 'react';
import { motion, type Variants } from 'framer-motion';
import { Search, MoreHorizontal, Send, Loader2, Mic, Square, Trash, X, Plus, Users } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useAuth, type UserProfile } from '../../context/AuthContext';
import { db } from '../../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';

interface MessagesViewProps {
    containerVariants: Variants;
    itemVariants: Variants;
    initialUserId?: string | null;
}

interface ChatParticipant {
    uid: string;
    displayName: string;
    photoURL: string;
}

interface Chat {
    id: string;
    participants: string[];
    participantDetails: ChatParticipant[];
    lastMessage: string;
    updatedAt: any;
    isGroup?: boolean;
    groupName?: string;
    groupAvatar?: string;
    clearedAt?: Record<string, any>;
    unreadCounts?: Record<string, number>;
}

interface Message {
    id: string;
    chatId: string;
    senderId: string;
    text: string;
    audioUrl?: string;
    hiddenBy?: string[];
    readBy?: string[];
    createdAt: any;
}
import { Check, CheckCheck } from 'lucide-react';

export default function MessagesView({ containerVariants, itemVariants, initialUserId }: MessagesViewProps) {
    const { theme } = useAppContext();
    const { user, profile } = useAuth();

    const [chats, setChats] = useState<Chat[]>([]);
    const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loadingChats, setLoadingChats] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);

    // Voice Note State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Group Chat State
    const [showNewGroupModal, setShowNewGroupModal] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [platformUsers, setPlatformUsers] = useState<UserProfile[]>([]);
    const [selectedGroupUsers, setSelectedGroupUsers] = useState<string[]>([]);
    const [creatingGroup, setCreatingGroup] = useState(false);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // 1. Listen to user's chats
    useEffect(() => {
        if (!user?.uid) return;

        const q = query(
            collection(db, 'chats'),
            where('participants', 'array-contains', user.uid),
            orderBy('updatedAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const fetchedChats: Chat[] = [];
            snapshot.forEach((doc) => {
                fetchedChats.push({ id: doc.id, ...doc.data() } as Chat);
            });
            setChats(fetchedChats);
            setLoadingChats(false);

            // Handle initial auto-creation or selection
            if (initialUserId) {
                const existingChat = fetchedChats.find(c => c.participants.includes(initialUserId));
                if (existingChat) {
                    if (!selectedChat || selectedChat.id !== existingChat.id) {
                        setSelectedChat(existingChat);
                    }
                } else if (!snapshot.metadata.hasPendingWrites) {
                    // Chat doesn't exist, we need to create it
                    await createNewChat(initialUserId);
                }
            } else if (fetchedChats.length > 0 && !selectedChat) {
                setSelectedChat(fetchedChats[0]);
            }
        }, (error) => {
            console.error("CHATS LISTENER ERROR:", error);
            console.error("EXACT ERROR MESSAGE:", error.message);
        });

        return () => unsubscribe();
    }, [user?.uid, initialUserId]);

    const createNewChat = async (targetUserId: string) => {
        if (!user || !profile) return;

        try {
            // Fetch target user details
            const targetUserDoc = await getDoc(doc(db, 'users', targetUserId));
            if (!targetUserDoc.exists()) return;
            const targetProfile = targetUserDoc.data() as UserProfile;

            const newChatRef = doc(collection(db, 'chats'));
            const newChatData = {
                participants: [user.uid, targetUserId],
                participantDetails: [
                    { uid: user.uid, displayName: profile.displayName || 'Artist', photoURL: profile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}` },
                    { uid: targetProfile.uid, displayName: targetProfile.displayName || 'Artist', photoURL: targetProfile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${targetProfile.uid}` }
                ],
                lastMessage: '',
                updatedAt: serverTimestamp(),
                unreadCounts: {
                    [user.uid]: 0,
                    [targetUserId]: 0
                }
            };

            await setDoc(newChatRef, newChatData);
            // The onSnapshot listener will pick this up and set it as selected
        } catch (error) {
            console.error("Error creating new chat:", error);
        }
    };

    // 2. Listen to messages for selected chat
    useEffect(() => {
        if (!selectedChat) return;

        setLoadingMessages(true);
        const q = query(
            collection(db, 'messages'),
            where('chatId', '==', selectedChat.id),
            orderBy('createdAt', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedMessages: Message[] = [];
            const userClearedAt = selectedChat.clearedAt?.[user?.uid || '']?.toDate?.() || new Date(0);

            snapshot.forEach((doc) => {
                const msgData = doc.data() as Message;
                // Filter out messages deleted 'for me'
                if (msgData.hiddenBy?.includes(user?.uid || '')) return;

                // Filter out messages older than the user's clear chat timestamp
                const msgTime = msgData.createdAt?.toDate?.() || new Date();
                if (msgTime < userClearedAt) return;

                fetchedMessages.push({ ...doc.data(), id: doc.id } as Message);
            });

            // Mark unread messages as read
            if (user?.uid) {
                snapshot.forEach((docSnap) => {
                    const msgData = docSnap.data() as Message;
                    if (msgData.senderId !== user.uid && (!msgData.readBy || !msgData.readBy.includes(user.uid))) {
                        updateDoc(docSnap.ref, {
                            readBy: [...(msgData.readBy || []), user.uid]
                        });
                    }
                });
            }

            setMessages(fetchedMessages);
            setLoadingMessages(false);
        });

        // Clear own unread count when chat is selected
        if (user?.uid && selectedChat.unreadCounts?.[user.uid]) {
            updateDoc(doc(db, 'chats', selectedChat.id), {
                [`unreadCounts.${user.uid}`]: 0
            });
        }

        return () => unsubscribe();
    }, [selectedChat, user?.uid]); // Changed dependency to whole selectedChat object and user.uid to pick up clearedAt changes

    // --- Group Chat ---
    const fetchPlatformUsers = async () => {
        if (!user) return;
        try {
            const q = query(collection(db, 'users'));
            const snapshot = await getDocs(q);
            const users: UserProfile[] = [];
            snapshot.forEach(doc => {
                if (doc.id !== user.uid) {
                    users.push(doc.data() as UserProfile);
                }
            });
            setPlatformUsers(users);
        } catch (error) {
            console.error("Error fetching users for group:", error);
        }
    };

    const handleOpenGroupModal = () => {
        setShowNewGroupModal(true);
        fetchPlatformUsers();
    };

    const handleCreateGroup = async () => {
        if (!user || !profile || !groupName.trim() || selectedGroupUsers.length === 0) return;
        setCreatingGroup(true);

        try {
            // Get details for selected users
            const selectedDetails = platformUsers.filter(u => selectedGroupUsers.includes(u.uid));

            const participantDetails = [
                { uid: user.uid, displayName: profile.displayName || 'Artist', photoURL: profile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}` },
                ...selectedDetails.map(u => ({ uid: u.uid, displayName: u.displayName || 'Artist', photoURL: u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}` }))
            ];

            const initialUnreadCounts: Record<string, number> = {};
            [user.uid, ...selectedGroupUsers].forEach(uid => {
                initialUnreadCounts[uid] = 0;
            });

            const newChatRef = doc(collection(db, 'chats'));
            const newChatData = {
                isGroup: true,
                groupName: groupName.trim(),
                participants: [user.uid, ...selectedGroupUsers],
                participantDetails: participantDetails,
                lastMessage: 'Group created',
                updatedAt: serverTimestamp(),
                unreadCounts: initialUnreadCounts
            };

            await setDoc(newChatRef, newChatData);
            setShowNewGroupModal(false);
            setGroupName('');
            setSelectedGroupUsers([]);
        } catch (error) {
            console.error("Error creating group:", error);
            alert("Failed to create group");
        } finally {
            setCreatingGroup(false);
        }
    };

    // --- Message Management ---
    const handleClearChat = async () => {
        if (!selectedChat || !user) return;
        if (!window.confirm("Are you sure you want to clear this chat for yourself?")) return;

        try {
            await updateDoc(doc(db, 'chats', selectedChat.id), {
                [`clearedAt.${user.uid}`]: serverTimestamp()
            });
            // Update local state to trigger re-render and re-subscribe
            setSelectedChat(prev => prev ? {
                ...prev,
                clearedAt: { ...(prev.clearedAt || {}), [user.uid]: { toDate: () => new Date() } }
            } : null);
        } catch (error) {
            console.error("Error clearing chat:", error);
        }
    };

    const handleDeleteForMe = async (msgId: string) => {
        if (!user) return;
        try {
            const msgRef = doc(db, 'messages', msgId);
            const msgDoc = await getDoc(msgRef);
            if (msgDoc.exists()) {
                const hiddenBy = msgDoc.data().hiddenBy || [];
                await updateDoc(msgRef, {
                    hiddenBy: [...hiddenBy, user.uid]
                });
            }
        } catch (error) {
            console.error("Error deleting message for me:", error);
        }
    };

    const handleUnsend = async (msgId: string, senderId: string) => {
        if (!user || senderId !== user.uid) return;
        if (!window.confirm("Unsend message for everyone?")) return;
        try {
            await deleteDoc(doc(db, 'messages', msgId));
        } catch (error) {
            console.error("Error unsending message:", error);
        }
    };

    // --- Voice Notes ---
    const handleStartRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorder.onstart = () => {
                setIsRecording(true);
                setRecordingDuration(0);
            };

            mediaRecorder.onstop = async () => {
                setIsRecording(false);
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                await uploadAndSendVoiceNote(audioBlob);
                stream.getTracks().forEach(track => track.stop()); // Stop microphone
            };

            mediaRecorder.start(100);
        } catch (error) {
            console.error("Error accessing microphone:", error);
            alert("Microphone access is required for voice notes.");
        }
    };

    const handleStopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
        }
    };

    const uploadAndSendVoiceNote = async (audioBlob: Blob) => {
        if (!selectedChat || !user) return;

        // Optimistic UI could be added here, but for simplicity we rely on the loader

        try {
            const formData = new FormData();
            formData.append('file', audioBlob);
            formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET!);
            formData.append('resource_type', 'video'); // Cloudinary treats audio as video

            const cloudinaryReq = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/video/upload`, {
                method: 'POST',
                body: formData,
            });

            if (!cloudinaryReq.ok) throw new Error("Voice note upload failed");
            const cloudinaryRes = await cloudinaryReq.json();
            const audioUrl = cloudinaryRes.secure_url;

            await addDoc(collection(db, 'messages'), {
                chatId: selectedChat.id,
                senderId: user.uid,
                text: '🎤 Voice message',
                audioUrl: audioUrl,
                createdAt: serverTimestamp(),
                readBy: [user.uid]
            });

            // Update unread counts for others
            const chatUpdatePayload: any = {
                lastMessage: '🎤 Voice message',
                updatedAt: serverTimestamp()
            };
            selectedChat.participants.forEach(pId => {
                if (pId !== user.uid) {
                    chatUpdatePayload[`unreadCounts.${pId}`] = (selectedChat.unreadCounts?.[pId] || 0) + 1;
                }
            });

            await updateDoc(doc(db, 'chats', selectedChat.id), chatUpdatePayload);

        } catch (error) {
            console.error("Error sending voice note:", error);
            alert("Failed to send voice note.");
        }
    };

    // Timer effect for voice note
    useEffect(() => {
        let interval: ReturnType<typeof setTimeout>;
        if (isRecording) {
            interval = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isRecording]);

    const formatDuration = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedChat || !user) return;

        const messageText = newMessage.trim();
        setNewMessage(''); // optimistic clear

        try {
            // 1. Add message
            await addDoc(collection(db, 'messages'), {
                chatId: selectedChat.id,
                senderId: user.uid,
                text: messageText,
                createdAt: serverTimestamp(),
                readBy: [user.uid]
            });

            // 2. Update chat lastMessage & updatedAt & unreadCounts
            const chatUpdatePayload: any = {
                lastMessage: messageText,
                updatedAt: serverTimestamp()
            };
            selectedChat.participants.forEach(pId => {
                if (pId !== user.uid) {
                    chatUpdatePayload[`unreadCounts.${pId}`] = (selectedChat.unreadCounts?.[pId] || 0) + 1;
                }
            });

            await updateDoc(doc(db, 'chats', selectedChat.id), chatUpdatePayload);
        } catch (error) {
            console.error("Error sending message:", error);
            alert("Failed to send message");
        }
    };


    const getOtherParticipant = (chat: Chat) => {
        if (!user) return null;
        return chat.participantDetails.find(p => p.uid !== user.uid);
    };

    const formatTime = (timestamp: any) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <motion.div
            className="flex-1 flex overflow-hidden mr-4 my-4 rounded-[2.5rem] shadow-sm border"
            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            variants={containerVariants}
            initial="hidden"
            animate="show"
        >
            {/* Contacts Sidebar */}
            <motion.div
                variants={itemVariants}
                className="w-[380px] border-r flex flex-col h-full"
                style={{ borderColor: theme.border }}
            >
                <div className="p-6 pb-4">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 opacity-50" size={18} style={{ color: theme.text }} />
                            <input
                                type="text"
                                placeholder="Search Messages"
                                className="w-full rounded-full py-3 pl-12 pr-6 border-none focus:outline-none focus:ring-2 font-medium"
                                style={{ backgroundColor: `${theme.primary}4D`, color: theme.text }}
                            />
                        </div>
                        <button
                            onClick={handleOpenGroupModal}
                            title="New Group Chat"
                            className="w-12 h-12 flex items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95 shadow-sm"
                            style={{ backgroundColor: theme.primary, color: theme.background }}
                        >
                            <Plus size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-1 custom-scrollbar">
                    {loadingChats ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="animate-spin" style={{ color: theme.text }} />
                        </div>
                    ) : chats.length === 0 ? (
                        <div className="text-center p-8 opacity-50 font-medium" style={{ color: theme.text }}>
                            No conversations yet.<br />Go to Artists to start a chat!
                        </div>
                    ) : (
                        chats.map((chat) => {
                            const isSelected = selectedChat?.id === chat.id;
                            let chatTitle = "Chat";
                            let chatAvatar = "https://api.dicebear.com/7.x/avataaars/svg?seed=group";

                            if (chat.isGroup) {
                                chatTitle = chat.groupName || "Group Chat";
                            } else {
                                const otherUser = getOtherParticipant(chat);
                                if (!otherUser) return null;
                                chatTitle = otherUser.displayName;
                                chatAvatar = otherUser.photoURL;
                            }

                            return (
                                <button
                                    key={chat.id}
                                    onClick={() => setSelectedChat(chat)}
                                    className="flex items-center gap-4 p-3 rounded-2xl w-full text-left transition-colors"
                                    style={{ backgroundColor: isSelected ? `${theme.primary}33` : 'transparent' }}
                                >
                                    <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border-2 flex items-center justify-center" style={{ backgroundColor: theme.surface, borderColor: isSelected ? theme.primary : 'transparent' }}>
                                        {chat.isGroup ? <Users size={24} className="opacity-50" /> : <img src={chatAvatar} alt="avatar" className="w-full h-full object-cover" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-baseline mb-0.5 mt-1">
                                            <h4 className="font-bold text-base truncate pr-2" style={{ color: theme.text }}>{chatTitle}</h4>
                                            <span className="text-xs font-semibold opacity-50 flex-shrink-0" style={{ color: theme.text }}>
                                                {formatTime(chat.updatedAt)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center pr-1">
                                            <p className="text-[13px] truncate opacity-80 font-medium" style={{ color: theme.text }}>
                                                {chat.lastMessage || "Started a chat"}
                                            </p>
                                            {(chat.unreadCounts?.[user?.uid || ''] || 0) > 0 && (
                                                <div className="bg-red-500 text-white text-[10px] font-bold min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full shadow-sm ml-2">
                                                    {(chat.unreadCounts?.[user?.uid || ''] || 0) > 20 ? '20+' : chat.unreadCounts?.[user?.uid || '']}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            </motion.div>

            {/* Chat Area */}
            <motion.div variants={itemVariants} className="flex-1 flex flex-col h-full bg-[#00000005]">
                {selectedChat ? (() => {

                    let chatTitle = "Group Chat";
                    let chatAvatar = "";
                    let chatSubtitle = "Multiple Participants";

                    if (selectedChat.isGroup) {
                        chatTitle = selectedChat.groupName || "Group Chat";
                        chatSubtitle = `${selectedChat.participants.length} members`;
                    } else {
                        const otherUser = getOtherParticipant(selectedChat);
                        chatTitle = otherUser?.displayName || "Artist";
                        chatAvatar = otherUser?.photoURL || "";
                        chatSubtitle = "Artist";
                    }

                    return (
                        <>
                            {/* Chat Header */}
                            <div className="px-8 py-5 border-b flex justify-between items-center" style={{ borderColor: theme.border }}>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border-2 flex items-center justify-center" style={{ backgroundColor: theme.surface, borderColor: theme.surface }}>
                                        {selectedChat.isGroup ? <Users size={24} className="opacity-50" /> : <img src={chatAvatar} alt="avatar" className="w-full h-full object-cover" />}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg leading-tight" style={{ color: theme.text }}>{chatTitle}</h3>
                                        <p className="text-sm font-medium opacity-60 m-0" style={{ color: theme.text }}>{chatSubtitle}</p>
                                    </div>
                                </div>
                                <div className="relative group/menu">
                                    <button className="p-2 hover:bg-black/5 rounded-full transition-colors focus:outline-none">
                                        <MoreHorizontal size={24} style={{ color: theme.text }} />
                                    </button>
                                    <div className="absolute right-0 mt-2 w-48 rounded-xl shadow-lg border opacity-0 group-hover/menu:opacity-100 pointer-events-none group-hover/menu:pointer-events-auto transition-opacity z-10" style={{ backgroundColor: theme.surface, borderColor: theme.border }}>
                                        <button
                                            onClick={handleClearChat}
                                            className="w-full text-left px-4 py-3 hover:bg-red-50 text-red-600 font-bold rounded-xl flex items-center gap-2"
                                        >
                                            <Trash size={16} /> Clear Chat (For Me)
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Chat History */}
                            <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6 custom-scrollbar">
                                {loadingMessages ? (
                                    <div className="flex justify-center items-center h-full">
                                        <Loader2 className="animate-spin" style={{ color: theme.text }} />
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full opacity-50 space-y-4">
                                        <span className="text-4xl">👋</span>
                                        <p className="font-bold" style={{ color: theme.text }}>Say hello to {chatTitle}!</p>
                                    </div>
                                ) : (
                                    <>
                                        {messages.map((msg) => {
                                            const isMe = msg.senderId === user?.uid;
                                            const senderDetails = selectedChat.participantDetails?.find(p => p.uid === msg.senderId);
                                            const senderAvatar = senderDetails?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderId}`;

                                            return (
                                                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start gap-3'} group/message`}>
                                                    {!isMe && (
                                                        <img src={senderAvatar} alt="avatar" className="w-8 h-8 rounded-full shadow-sm mt-auto mb-1 flex-shrink-0" title={senderDetails?.displayName} />
                                                    )}

                                                    {/* Message Actions (Hovered) */}
                                                    {isMe && (
                                                        <div className="opacity-0 group-hover/message:opacity-100 transition-opacity flex items-center pr-2 gap-2">
                                                            <button title="Unsend (For Everyone)" onClick={() => handleUnsend(msg.id, msg.senderId)} className="text-gray-400 hover:text-red-500 transition-colors">
                                                                <X size={16} />
                                                            </button>
                                                            <button title="Delete (For Me)" onClick={() => handleDeleteForMe(msg.id)} className="text-gray-400 hover:text-orange-500 transition-colors">
                                                                <Trash size={16} />
                                                            </button>
                                                        </div>
                                                    )}

                                                    <div className={`max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                                        <div
                                                            className={`px-5 py-3 shadow-sm rounded-2xl ${isMe ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
                                                            style={{
                                                                backgroundColor: isMe ? theme.primary : theme.background,
                                                                color: theme.text,
                                                                border: isMe ? 'none' : `1px solid ${theme.border}`
                                                            }}
                                                        >
                                                            {msg.audioUrl ? (
                                                                <div className="flex flex-col gap-1 min-w-[200px]">
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <Mic size={14} className={isMe ? 'opacity-80' : 'opacity-50'} />
                                                                        <span className="text-sm font-bold opacity-80">Voice Message</span>
                                                                    </div>
                                                                    <audio controls src={msg.audioUrl} className={isMe ? 'custom-audio-player-me' : 'custom-audio-player'} />
                                                                </div>
                                                            ) : (
                                                                <p className="font-medium whitespace-pre-wrap break-words">{msg.text}</p>
                                                            )}
                                                        </div>
                                                        <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                                            <p className={`text-[11px] opacity-60 font-semibold`} style={{ color: theme.text }}>
                                                                {formatTime(msg.createdAt)}
                                                            </p>
                                                            {isMe && (
                                                                <span className="ml-1 flex-shrink-0">
                                                                    {msg.readBy && msg.readBy.length > 1 ? (
                                                                        <CheckCheck size={14} className="text-blue-500" />
                                                                    ) : (
                                                                        <Check size={14} className="opacity-40" style={{ color: theme.text }} />
                                                                    )}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Other person's message actions */}
                                                    {!isMe && (
                                                        <div className="opacity-0 group-hover/message:opacity-100 transition-opacity flex items-center pl-2">
                                                            <button title="Delete (For Me)" onClick={() => handleDeleteForMe(msg.id)} className="text-gray-400 hover:text-orange-500 transition-colors">
                                                                <Trash size={16} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        <div ref={messagesEndRef} />
                                    </>
                                )}
                            </div>

                            {/* Chat Input */}
                            <form onSubmit={handleSendMessage} className="p-6 pt-2">
                                <div className="relative flex items-center gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            placeholder={isRecording ? `Recording... ${formatDuration(recordingDuration)}` : "Send a message"}
                                            disabled={isRecording}
                                            className={`w-full rounded-full py-4 pl-6 pr-14 border-none focus:outline-none focus:ring-2 font-medium shadow-sm transition-shadow ${isRecording ? 'opacity-50 text-red-500' : ''}`}
                                            style={{ backgroundColor: theme.background, color: theme.text }}
                                        />
                                        {!isRecording && (
                                            <button
                                                type="submit"
                                                disabled={!newMessage.trim()}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full transition-transform hover:scale-110 active:scale-95 shadow-md disabled:opacity-50 disabled:hover:scale-100"
                                                style={{ backgroundColor: theme.primary, color: theme.background }}
                                            >
                                                <Send size={18} className="ml-[-2px] mt-[2px]" />
                                            </button>
                                        )}
                                    </div>

                                    {/* Mic Button */}
                                    <button
                                        type="button"
                                        onClick={isRecording ? handleStopRecording : handleStartRecording}
                                        className={`w-14 h-14 flex items-center justify-center rounded-full transition-all shadow-md flex-shrink-0 hover:brightness-110 ${isRecording ? 'bg-red-500 text-white animate-pulse' : ''}`}
                                        style={!isRecording ? { backgroundColor: theme.surface, color: theme.primary, border: `1px solid ${theme.border}` } : {}}
                                    >
                                        {isRecording ? <Square size={20} className="fill-current" /> : <Mic size={24} />}
                                    </button>
                                </div>
                            </form>
                        </>
                    );
                })() : (
                    <div className="flex-1 flex items-center justify-center opacity-50">
                        <p className="font-bold text-lg" style={{ color: theme.text }}>Select a conversation to start chatting</p>
                    </div>
                )}
            </motion.div>

            {/* New Group Modal */}
            {showNewGroupModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh] border"
                        style={{ backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }}
                    >
                        <div className="p-6 border-b flex justify-between items-center" style={{ borderColor: theme.border }}>
                            <h2 className="text-xl font-bold">New Group Chat</h2>
                            <button onClick={() => setShowNewGroupModal(false)} className="opacity-50 hover:opacity-100 transition-opacity">
                                <X size={24} style={{ color: theme.text }} />
                            </button>
                        </div>
                        <div className="p-6 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
                            <div>
                                <label className="block text-sm font-bold mb-2 text-gray-700">Group Name</label>
                                <input
                                    type="text"
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    placeholder="e.g. Gallery Curators"
                                    className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#fcaab8]/50 font-medium"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-2 text-gray-700">Select Members</label>
                                <div className="flex flex-col gap-2 max-h-60 overflow-y-auto p-1">
                                    {platformUsers.map(u => (
                                        <label key={u.uid} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={selectedGroupUsers.includes(u.uid)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedGroupUsers(prev => [...prev, u.uid]);
                                                    else setSelectedGroupUsers(prev => prev.filter(id => id !== u.uid));
                                                }}
                                                className="w-5 h-5 rounded border-gray-300 text-[#fcaab8] focus:ring-[#fcaab8]"
                                            />
                                            <img src={u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`} alt="avatar" className="w-8 h-8 rounded-full" />
                                            <span className="font-semibold">{u.displayName || 'Artist'}</span>
                                        </label>
                                    ))}
                                    {platformUsers.length === 0 && (
                                        <p className="text-sm opacity-50 italic">No other users found.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t flex justify-end gap-3" style={{ borderColor: theme.border }}>
                            <button
                                onClick={() => setShowNewGroupModal(false)}
                                className="px-6 py-2.5 rounded-full font-bold opacity-70 hover:opacity-100 transition-opacity"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateGroup}
                                disabled={!groupName.trim() || selectedGroupUsers.length === 0 || creatingGroup}
                                className="px-6 py-2.5 rounded-full font-bold shadow-md transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
                                style={{ backgroundColor: theme.primary, color: theme.background }}
                            >
                                {creatingGroup ? <Loader2 size={16} className="animate-spin" /> : 'Create Group'}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </motion.div>
    );
}
