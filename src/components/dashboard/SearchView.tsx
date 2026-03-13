
import { useState, useEffect } from 'react';
import { motion, type Variants } from 'framer-motion';
import { Search, User, X } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import type { UserProfile } from '../../context/AuthContext';

interface SearchViewProps {
    containerVariants: Variants;
    itemVariants: Variants;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    onUserSelect: (userId: string) => void;
}

export default function SearchView({ containerVariants, itemVariants, searchQuery, setSearchQuery, onUserSelect }: SearchViewProps) {
    const { theme } = useAppContext();
    const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [recentSearches, setRecentSearches] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('artspace_recent_searches');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    const addRecentSearch = (queryStr: string) => {
        const trimmed = queryStr.trim();
        if (!trimmed) return;
        setRecentSearches(prev => {
            const filtered = prev.filter(s => s.toLowerCase() !== trimmed.toLowerCase());
            const updated = [trimmed, ...filtered].slice(0, 10);
            localStorage.setItem('artspace_recent_searches', JSON.stringify(updated));
            return updated;
        });
    };

    const removeRecentSearch = (queryStr: string) => {
        setRecentSearches(prev => {
            const updated = prev.filter(s => s !== queryStr);
            localStorage.setItem('artspace_recent_searches', JSON.stringify(updated));
            return updated;
        });
    };

    const clearAllSearches = () => {
        setRecentSearches([]);
        localStorage.removeItem('artspace_recent_searches');
    };

    useEffect(() => {
        const performSearch = async () => {
            if (!searchQuery.trim()) {
                setSearchResults([]);
                return;
            }

            setIsSearching(true);
            try {
                // To do prefix search in Firestore: >= query, <= query + '\uf8ff'
                const lowerQuery = searchQuery.toLowerCase();
                const usersRef = collection(db, 'users');
                const q = query(
                    usersRef,
                    where('usernameLowercase', '>=', lowerQuery),
                    where('usernameLowercase', '<=', lowerQuery + '\uf8ff'),
                    limit(20)
                );

                const snapshot = await getDocs(q);
                const results: UserProfile[] = [];
                snapshot.forEach(doc => {
                    results.push(doc.data() as UserProfile);
                });

                setSearchResults(results);
            } catch (error) {
                console.error("Search failed:", error);
            } finally {
                setIsSearching(false);
            }
        };

        // Debounce search slightly
        const timeoutId = setTimeout(performSearch, 300);
        return () => clearTimeout(timeoutId);
    }, [searchQuery]);

    return (
        <motion.div
            className="flex-1 overflow-y-auto px-8 pb-12 pt-8 flex flex-col gap-10 max-w-4xl"
            variants={containerVariants}
            initial="hidden"
            animate="show"
        >
            {searchQuery.trim() ? (
                <motion.div variants={itemVariants} className="flex flex-col gap-4">
                    <h2 className="text-2xl font-bold tracking-tight mb-2" style={{ color: theme.text }}>
                        {isSearching ? 'Searching...' : `Search Results for "${searchQuery}"`}
                    </h2>

                    {searchResults.length === 0 && !isSearching ? (
                        <div className="text-center py-10 opacity-60 font-medium" style={{ color: theme.text }}>
                            No users found matching "{searchQuery}"
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {searchResults.map((user) => (
                                <motion.div
                                    key={user.uid}
                                    onClick={() => {
                                        addRecentSearch(searchQuery);
                                        onUserSelect(user.uid);
                                    }}
                                    className="flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all hover:scale-105 border shadow-sm"
                                    style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <div className="w-12 h-12 rounded-full overflow-hidden border bg-gray-100" style={{ borderColor: theme.border }}>
                                        {user.photoURL ? (
                                            <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full object-cover" />
                                        ) : (
                                            <User size={24} className="m-auto mt-3 opacity-50" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-lg truncate" style={{ color: theme.text }}>{user.displayName || 'Anonymous'}</h3>
                                        <p className="text-sm opacity-70 truncate font-medium" style={{ color: theme.text }}>
                                            @{user.username || 'unknown'}
                                        </p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </motion.div>
            ) : (
                <motion.div variants={itemVariants} className="flex flex-col gap-4">
                    <div className="flex justify-between items-end mb-4">
                        <h2 className="text-2xl font-bold tracking-tight" style={{ color: theme.text }}>Recent Searches</h2>
                        {recentSearches.length > 0 && (
                            <button
                                onClick={clearAllSearches}
                                className="text-sm font-bold opacity-70 hover:opacity-100 transition-opacity"
                                style={{ color: theme.text }}
                            >
                                Clear All
                            </button>
                        )}
                    </div>

                    {recentSearches.length === 0 ? (
                        <div className="text-center py-10 opacity-60 font-medium" style={{ color: theme.text }}>
                            No recent searches
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-3">
                            {recentSearches.map((search, i) => (
                                <div
                                    key={i}
                                    className="flex items-center gap-1 pl-4 pr-2 py-2 rounded-full font-semibold transition-all hover:scale-105 shadow-sm border"
                                    style={{ backgroundColor: `${theme.primary}B3`, color: theme.text, borderColor: theme.border }}
                                >
                                    <div
                                        className="flex items-center gap-2 cursor-pointer"
                                        onClick={() => setSearchQuery(search)}
                                    >
                                        <Search size={16} opacity={0.6} />
                                        <span>{search}</span>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeRecentSearch(search);
                                        }}
                                        className="p-1 rounded-full opacity-50 hover:opacity-100 hover:bg-black/10 transition-all ml-1"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </motion.div>
            )}
        </motion.div>
    );
}
