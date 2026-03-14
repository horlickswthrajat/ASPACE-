import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { Search, Home, Bell, Mail, User, LayoutGrid, LogOut, Users, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ProfileModal from '../components/ProfileModal';
import SettingsModal from '../components/SettingsModal';
import HomeView from '../components/dashboard/HomeView';
import SearchView from '../components/dashboard/SearchView';
import ArtistsView from '../components/dashboard/ArtistsView';
import NotificationsPopover from '../components/dashboard/NotificationsPopover';
import MessagesView from '../components/dashboard/MessagesView';
import ProfileView from '../components/dashboard/ProfileView';
import CreateRoomWizard from '../components/dashboard/CreateRoomWizard';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

import PublicProfileView from '../components/dashboard/PublicProfileView';

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    show: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { type: "spring", stiffness: 300, damping: 24 }
    }
};

export default function DashboardPage() {
    const navigate = useNavigate();
    const { theme } = useAppContext();
    const { user, profile, loading, signOut, updateUserProfile } = useAuth();

    useEffect(() => {
        if (!loading && !user) {
            navigate('/login');
        }
    }, [user, loading, navigate]);

    // UI State
    const [activeTab, setActiveTab] = useState('Home');
    const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
    const [initialMessageUserId, setInitialMessageUserId] = useState<string | null>(null);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
    const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');

    // Subscribe to unread counts
    useEffect(() => {
        if (!user) return;

        // Unread Notifications
        const notifQuery = query(
            collection(db, 'notifications'),
            where('ownerId', '==', user.uid),
            where('read', '==', false)
        );

        const unsubNotifs = onSnapshot(notifQuery, (snapshot) => {
            setUnreadNotificationsCount(snapshot.docs.length);
        });

        // Unread Messages loop
        const chatsQuery = query(
            collection(db, 'chats'),
            where('participants', 'array-contains', user.uid)
        );

        const unsubChats = onSnapshot(chatsQuery, (snapshot) => {
            let totalUnread = 0;
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.unreadCounts && data.unreadCounts[user.uid]) {
                    totalUnread += data.unreadCounts[user.uid];
                }
            });
            setUnreadMessagesCount(totalUnread);
        });

        return () => {
            unsubNotifs();
            unsubChats();
        };
    }, [user]);

    const handleProfileSave = async (newName: string, newUsername: string, newAvatarUrl: string, newBio: string, newArtStyles: string[]) => {
        try {
            await updateUserProfile(newName, newUsername, newAvatarUrl, newBio, newArtStyles);
        } catch (error) {
            console.error("Failed to update profile", error);
            alert("Failed to update profile. Please try again.");
        }
    };

    if (loading || !profile) {
        return <div className="min-h-screen flex items-center justify-center font-bold transition-colors duration-1000" style={{ backgroundColor: theme.background, color: theme.text }}>Loading Art Space...</div>;
    }

    return (
        <motion.div
            className="absolute inset-0 flex flex-col lg:flex-row z-30 overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, filter: 'blur(10px)' }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{ backgroundColor: theme.background }}
        >
            {/* Sidebar Gradient overlay to match reference left side - Hidden on mobile */}
            <div
                className="absolute top-0 left-0 bottom-0 w-[400px] pointer-events-none transition-all duration-1000 hidden lg:block"
                style={{ background: `linear-gradient(to right, ${theme.primary}E6, transparent)` }}
            />

            {/* Sidebar - Hidden on mobile */}
            <motion.aside
                className="w-72 hidden lg:flex flex-col p-8 z-10 relative"
                variants={containerVariants}
                initial="hidden"
                animate="show"
            >
                <motion.div variants={itemVariants} className="flex items-center gap-3 mb-12 px-2">
                    <div
                        className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg cursor-pointer shadow-lg transition-colors duration-500"
                        onClick={() => navigate('/')}
                        style={{ backgroundColor: theme.text, color: theme.background }}
                    >
                        A
                    </div>
                    <span className="text-2xl font-bold tracking-tight transition-colors duration-500" style={{ color: theme.text }}>ArtSpace</span>
                </motion.div>

                <nav className="flex-1 flex flex-col gap-3">
                    {[
                        { icon: Home, label: 'Home' },
                        { icon: Search, label: 'Search' },
                        { icon: Users, label: 'Artists' },
                        { icon: LayoutGrid, label: 'Builder' },
                        { icon: Bell, label: 'Notifications' },
                        { icon: Mail, label: 'Messages' },
                        { icon: User, label: 'Profile' },
                        { icon: Settings, label: 'Settings' }
                    ].map((item, index) => {
                        const isActive = activeTab === item.label && item.label !== 'Settings';
                        return (
                            <motion.button
                                key={index}
                                onClick={() => {
                                    if (item.label === 'Settings') {
                                        setIsSettingsModalOpen(true);
                                    } else if (item.label === 'Notifications') {
                                        setIsNotificationsOpen(true);
                                    } else {
                                        setActiveTab(item.label);
                                    }
                                }}
                                variants={itemVariants}
                                whileHover={{ scale: 1.05, x: 5 }}
                                whileTap={{ scale: 0.95 }}
                                className={`flex items-center gap-4 px-5 py-4 rounded-[1.5rem] transition-all font-semibold text-lg neumorphic-glass`}
                                style={{
                                    backgroundColor: isActive ? theme.primary : theme.surface,
                                    color: theme.text,
                                    opacity: isActive ? 1 : 0.8,
                                    boxShadow: isActive ? 'inset 4px 4px 8px rgba(0,0,0,0.06), inset -4px -4px 8px rgba(255,255,255,0.4)' : undefined
                                }}
                            >
                                <div className="relative">
                                    <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                                    {((item.label === 'Notifications' && unreadNotificationsCount > 0) || (item.label === 'Messages' && unreadMessagesCount > 0)) && (
                                        <div className="absolute -top-1.5 -right-2.5 bg-red-500 text-white text-[10px] font-bold min-w-[1.25rem] h-5 px-1 flex items-center justify-center rounded-full shadow-sm border-[1.5px] pointer-events-none" style={{ borderColor: theme.surface }}>
                                            {item.label === 'Notifications'
                                                ? (unreadNotificationsCount > 20 ? '20+' : unreadNotificationsCount)
                                                : (unreadMessagesCount > 20 ? '20+' : unreadMessagesCount)
                                            }
                                        </div>
                                    )}
                                </div>
                                {item.label}
                            </motion.button>
                        );
                    })}
                </nav>

                <motion.button
                    variants={itemVariants}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={async () => {
                        await signOut();
                        navigate('/');
                    }}
                    className="mb-4 flex items-center justify-center gap-2 w-full py-3 rounded-[1.5rem] font-bold text-md transition-all neumorphic-glass hover:opacity-100"
                    style={{ backgroundColor: theme.surface, color: theme.text, opacity: 0.8 }}
                >
                    <LogOut size={18} />
                    Sign Out
                </motion.button>
            </motion.aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative z-10 p-2 pb-20 lg:pb-2">
                {/* Topbar */}
                <header className="flex items-center justify-between p-4 lg:p-8 pb-4">
                    <motion.div
                        initial={{ opacity: 0, y: -20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
                        className="relative w-full lg:w-[32rem] max-w-2xl group"
                    >
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 transition-colors z-10" style={{ color: theme.text, opacity: 0.5 }} size={20} strokeWidth={2.5} />
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                if (activeTab !== 'Search') setActiveTab('Search');
                            }}
                            onClick={() => {
                                if (activeTab !== 'Search') setActiveTab('Search');
                            }}
                            className="w-full border-none rounded-2xl py-4 pl-14 pr-6 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all font-semibold text-lg relative neumorphic-inset"
                            style={{
                                backgroundColor: theme.primary,
                                color: theme.text,
                            }}
                        />
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3, type: "spring", bounce: 0.5 }}
                        onClick={() => setIsProfileModalOpen(true)}
                        className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center cursor-pointer hover:scale-110 transition-all neumorphic-glass"
                        style={{ backgroundColor: theme.primary }}
                    >
                        <img src={profile.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'} alt="User Profile" className="w-full h-full object-cover" />
                    </motion.div>
                </header>

                {/* Main View Area */}
                {activeTab === 'Home' && <HomeView containerVariants={containerVariants} itemVariants={itemVariants} />}
                {activeTab === 'Search' && (
                    <SearchView
                        containerVariants={containerVariants}
                        itemVariants={itemVariants}
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        onUserSelect={(id) => {
                            setSelectedArtistId(id);
                            setActiveTab('PublicProfile');
                        }}
                    />
                )}
                {activeTab === 'Artists' && (
                    <ArtistsView
                        containerVariants={containerVariants}
                        itemVariants={itemVariants}
                        onArtistClick={(id) => {
                            setSelectedArtistId(id);
                            setActiveTab('PublicProfile');
                        }}
                    />
                )}
                {activeTab === 'PublicProfile' && selectedArtistId && (
                    <PublicProfileView
                        userId={selectedArtistId}
                        containerVariants={containerVariants}
                        itemVariants={itemVariants}
                        onBack={() => {
                            setSelectedArtistId(null);
                            setActiveTab('Artists');
                        }}
                        onMessage={() => {
                            setInitialMessageUserId(selectedArtistId);
                            setActiveTab('Messages');
                        }}
                    />
                )}
                {activeTab === 'Builder' && <CreateRoomWizard containerVariants={containerVariants} itemVariants={itemVariants} />}
                {activeTab === 'Messages' && (
                    <MessagesView
                        containerVariants={containerVariants}
                        itemVariants={itemVariants}
                        initialUserId={initialMessageUserId}
                    />
                )}
                {activeTab === 'Profile' && <ProfileView containerVariants={containerVariants} itemVariants={itemVariants} onEditProfile={() => setIsProfileModalOpen(true)} />}

                {/* Popovers */}
                <NotificationsPopover
                    isOpen={isNotificationsOpen}
                    onClose={() => setIsNotificationsOpen(false)}
                />

                {/* Bottom Navigation for Mobile */}
                <nav
                    className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around p-4 backdrop-blur-xl border-t neumorphic-glass"
                    style={{ backgroundColor: `${theme.surface}CC`, borderColor: theme.border }}
                >
                    {[
                        { icon: Home, label: 'Home' },
                        { icon: Search, label: 'Search' },
                        { icon: Users, label: 'Artists' },
                        { icon: LayoutGrid, label: 'Builder' },
                        { icon: User, label: 'Profile' }
                    ].map((item, index) => {
                        const isActive = activeTab === item.label;
                        return (
                            <button
                                key={index}
                                onClick={() => setActiveTab(item.label)}
                                className={`flex flex-col items-center gap-1 transition-all ${isActive ? 'scale-110' : 'opacity-60'}`}
                                style={{ color: isActive ? theme.primary : theme.text }}
                            >
                                <div className="relative">
                                    <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                                    {((item.label === 'Notifications' && unreadNotificationsCount > 0) || (item.label === 'Messages' && unreadMessagesCount > 0)) && (
                                        <div className="absolute -top-1 -right-2 bg-red-500 text-white text-[8px] font-bold min-w-[0.75rem] h-4 px-1 flex items-center justify-center rounded-full border shadow-sm">
                                            {item.label === 'Notifications' ? unreadNotificationsCount : unreadMessagesCount}
                                        </div>
                                    )}
                                </div>
                                <span className="text-[10px] font-bold">{item.label}</span>
                            </button>
                        );
                    })}
                    <button
                        onClick={() => setIsNotificationsOpen(true)}
                        className={`flex flex-col items-center gap-1 opacity-60`}
                        style={{ color: theme.text }}
                    >
                        <div className="relative">
                            <Bell size={24} />
                            {unreadNotificationsCount > 0 && (
                                <div className="absolute -top-1 -right-2 bg-red-500 text-white text-[8px] font-bold min-w-[0.75rem] h-4 px-1 flex items-center justify-center rounded-full border shadow-sm">
                                    {unreadNotificationsCount > 20 ? '20+' : unreadNotificationsCount}
                                </div>
                            )}
                        </div>
                        <span className="text-[10px] font-bold">Alerts</span>
                    </button>
                </nav>
            </main>

            {/* Modals */}
            <ProfileModal
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
                currentName={profile.displayName || 'Artist'}
                currentUsername={profile.username || ''}
                currentAvatarUrl={profile.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'}
                currentBio={profile.bio || ''}
                currentArtStyles={profile.artStyles || []}
                onSave={handleProfileSave}
            />

            <SettingsModal
                isOpen={isSettingsModalOpen}
                onClose={() => setIsSettingsModalOpen(false)}
            />
        </motion.div>
    );
}
