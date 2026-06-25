import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { Search, Home, Bell, Mail, User, LayoutGrid, LogOut, Users, Settings, Loader2, Download } from 'lucide-react';
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
import { getContrastColor } from '../utils/colorUtils';

import PublicProfileView from '../components/dashboard/PublicProfileView';
import Logo from '../components/Logo';

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
    const { theme, logoId } = useAppContext();
    const { user, profile, loading, signOut, updateUserProfile } = useAuth();

    useEffect(() => {
        if (!loading) {
            if (!user) {
                navigate('/login');
            } else if (!profile) {
                navigate('/setup-profile');
            }
        }
    }, [user, profile, loading, navigate]);

    // UI State
    const [activeTab, setActiveTab] = useState('Home');
    const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);

    // PWA Install Prompt State
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showInstallBtn, setShowInstallBtn] = useState(false);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowInstallBtn(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);

        if (window.matchMedia('(display-mode: standalone)').matches) {
            setShowInstallBtn(false);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        setDeferredPrompt(null);
        setShowInstallBtn(false);
    };
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
        }, (error: Error) => {
            console.error("Notifications snapshot error:", error);
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
        }, (error: Error) => {
            console.error("Chats snapshot error:", error);
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

    if (loading) {
        return (
            <div 
                className="w-full h-full min-h-screen flex flex-col items-center justify-center font-black transition-colors duration-500" 
                style={{ backgroundColor: theme?.background || '#010030', color: theme?.text || '#ffffff' }}
            >
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="mb-4"
                >
                    <Loader2 size={48} />
                </motion.div>
                <p className="text-xl">Initializing Art Space...</p>
            </div>
        );
    }

    if (!profile) {
        return null; // Will be redirected by useEffect
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
                className="w-20 xl:w-72 hidden lg:flex flex-col p-4 xl:p-8 z-10 relative border-r transition-all duration-300"
                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                variants={containerVariants}
                initial="hidden"
                animate="show"
            >
                <motion.div variants={itemVariants} className="flex items-center gap-3 mb-12 px-2 justify-center xl:justify-start">
                    <div
                        className="cursor-pointer transition-transform duration-300 hover:scale-105 flex-shrink-0"
                        onClick={() => navigate('/')}
                    >
                        <Logo id={logoId} size={40} animated={true} />
                    </div>
                    <span className="text-2xl font-black tracking-tight transition-colors duration-500 hidden xl:block" style={{ color: theme.text, fontFamily: "'Caveat', cursive" }}>ArtSpace</span>
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
                                whileHover={{ scale: 1.05, x: 2 }}
                                whileTap={{ scale: 0.95 }}
                                className={`flex items-center gap-4 px-3 xl:px-5 py-4 rounded-[1.5rem] transition-all font-semibold text-lg justify-center xl:justify-start neumorphic-glass`}
                                style={{
                                    backgroundColor: isActive ? theme.primary : theme.surface,
                                    color: theme.text,
                                    opacity: isActive ? 1 : 0.8,
                                    boxShadow: isActive ? 'inset 4px 4px 8px rgba(0,0,0,0.06), inset -4px -4px 8px rgba(255,255,255,0.4)' : undefined
                                }}
                                title={item.label}
                            >
                                <div className="relative flex items-center justify-center flex-shrink-0">
                                    {item.label === 'Profile' ? (
                                        <div 
                                            className={`w-7 h-7 rounded-full overflow-hidden border-2 transition-all ${isActive ? 'scale-105' : 'border-transparent'}`}
                                            style={{ borderColor: isActive ? theme.primary : 'transparent' }}
                                        >
                                            <img src={profile.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'} alt="Profile" className="w-full h-full object-cover" />
                                        </div>
                                    ) : (
                                        <>
                                            <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                                            {((item.label === 'Notifications' && unreadNotificationsCount > 0) || (item.label === 'Messages' && unreadMessagesCount > 0)) && (
                                                <div className="absolute -top-1.5 -right-2.5 bg-red-500 text-white text-[10px] font-bold min-w-[1.25rem] h-5 px-1 flex items-center justify-center rounded-full shadow-sm border-[1.5px] pointer-events-none" style={{ borderColor: theme.surface }}>
                                                    {item.label === 'Notifications'
                                                        ? (unreadNotificationsCount > 20 ? '20+' : unreadNotificationsCount)
                                                        : (unreadMessagesCount > 20 ? '20+' : unreadMessagesCount)
                                                    }
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                                <span className="hidden xl:block">{item.label}</span>
                            </motion.button>
                        );
                    })}
                </nav>
                {showInstallBtn && (
                    <motion.button
                        variants={itemVariants}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleInstallClick}
                        className="mb-3 flex items-center justify-center gap-2 w-full py-3.5 rounded-[1.5rem] font-black text-md transition-all shadow-lg hover:scale-105 border border-transparent cursor-pointer"
                        style={{ backgroundColor: theme.primary, color: getContrastColor(theme.primary) }}
                        title="Download App"
                    >
                        <Download size={18} strokeWidth={2.5} />
                        <span className="hidden xl:block">Download App</span>
                    </motion.button>
                )}

                <motion.button
                    variants={itemVariants}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={async () => {
                        await signOut();
                        navigate('/');
                    }}
                    className="mb-4 flex items-center justify-center gap-2 w-full py-3 rounded-[1.5rem] font-bold text-md transition-all neumorphic-glass hover:opacity-100 cursor-pointer"
                    style={{ backgroundColor: theme.surface, color: theme.text, opacity: 0.8 }}
                    title="Sign Out"
                >
                    <LogOut size={18} />
                    <span className="hidden xl:block">Sign Out</span>
                </motion.button>
            </motion.aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative z-10 p-2 pb-20 lg:pb-2">
                {/* Mobile Topbar */}
                <header 
                    className="lg:hidden flex items-center justify-between p-4 border-b z-40 backdrop-blur-xl" 
                    style={{ backgroundColor: `${theme.surface}B3`, borderColor: theme.border }}
                >
                    <div className="flex items-center gap-2" onClick={() => setActiveTab('Home')}>
                        <Logo id={logoId} size={30} animated={true} />
                        <span className="text-2xl font-black tracking-tight cursor-pointer" style={{ color: theme.text, fontFamily: "'Caveat', cursive" }}>ArtSpace</span>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Notifications */}
                        <button
                            onClick={() => setIsNotificationsOpen(true)}
                            className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                            style={{ color: theme.text }}
                        >
                            <Bell size={22} />
                            {unreadNotificationsCount > 0 && (
                                <div className="absolute top-1 right-1 bg-red-500 text-white text-[8px] font-bold min-w-[0.75rem] h-4 px-1 flex items-center justify-center rounded-full border shadow-sm" style={{ borderColor: theme.surface }}>
                                    {unreadNotificationsCount}
                                </div>
                            )}
                        </button>
                        
                        {/* Settings */}
                        <button
                            onClick={() => setIsSettingsModalOpen(true)}
                            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                            style={{ color: theme.text }}
                        >
                            <Settings size={22} />
                        </button>
                    </div>
                </header>

                {/* Desktop Topbar */}
                <header className="hidden lg:flex items-center justify-between p-4 lg:p-8 pb-4">
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
                        className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center cursor-pointer hover:scale-110 transition-all neumorphic-glass border-2"
                        style={{ backgroundColor: theme.primary, borderColor: theme.border }}
                    >
                        <img src={profile.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'} alt="User Profile" className="w-full h-full object-cover" />
                    </motion.div>
                </header>

                {/* PWA Mobile Banner */}
                {showInstallBtn && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="lg:hidden mx-4 mb-4 p-4 rounded-3xl flex items-center justify-between shadow-lg border"
                        style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm" style={{ backgroundColor: theme.primary, color: getContrastColor(theme.primary) }}>
                                A
                            </div>
                            <div>
                                <h4 className="font-bold text-sm" style={{ color: theme.text }}>Art Space App</h4>
                                <p className="text-xs opacity-75 font-semibold" style={{ color: theme.text }}>Install for full-screen experience</p>
                            </div>
                        </div>
                        <button
                            onClick={handleInstallClick}
                            className="px-4 py-2 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                            style={{ backgroundColor: theme.primary, color: getContrastColor(theme.primary) }}
                        >
                            Install
                        </button>
                    </motion.div>
                )}

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
                    className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around py-3 px-4 backdrop-blur-xl border-t neumorphic-glass shadow-2xl"
                    style={{ backgroundColor: `${theme.surface}E6`, borderColor: theme.border }}
                >
                    {[
                        { icon: Home, label: 'Home' },
                        { icon: Search, label: 'Search' },
                        { icon: LayoutGrid, label: 'Builder' },
                        { icon: Mail, label: 'Messages' },
                        { icon: User, label: 'Profile' }
                    ].map((item, index) => {
                        const isActive = activeTab === item.label;
                        const isProfileTab = item.label === 'Profile';
                        return (
                            <button
                                key={index}
                                onClick={() => setActiveTab(item.label)}
                                className={`flex flex-col items-center gap-0.5 transition-all ${isActive ? 'scale-105 font-bold' : 'opacity-65'}`}
                                style={{ color: isActive ? theme.primary : theme.text }}
                            >
                                <div className="relative w-8 h-8 flex items-center justify-center">
                                    {isProfileTab ? (
                                        <div 
                                            className={`w-7 h-7 rounded-full overflow-hidden border-2 transition-all ${isActive ? 'scale-105' : 'border-transparent'}`}
                                            style={{ borderColor: isActive ? theme.primary : 'transparent' }}
                                        >
                                            <img src={profile.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'} alt="Profile" className="w-full h-full object-cover" />
                                        </div>
                                    ) : (
                                        <>
                                            <item.icon size={23} strokeWidth={isActive ? 2.5 : 2} />
                                            {item.label === 'Messages' && unreadMessagesCount > 0 && (
                                                <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold min-w-[0.75rem] h-4 px-1 flex items-center justify-center rounded-full border shadow-sm" style={{ borderColor: theme.surface }}>
                                                    {unreadMessagesCount > 20 ? '20+' : unreadMessagesCount}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                                <span className="text-[9px] font-bold tracking-tight">{item.label}</span>
                            </button>
                        );
                    })}
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
