import React, { createContext, useContext, useState, useEffect } from 'react';
import {
    type User,
    signInWithPopup,
    GoogleAuthProvider,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut as firebaseSignOut,
    onAuthStateChanged
} from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';

export interface UserProfile {
    uid: string;
    email: string | null;
    displayName: string | null;
    username?: string;
    usernameLowercase?: string;
    lastUsernameChange?: any; // Firestore Timestamp
    photoURL: string | null;
    bio: string;
    artStyles?: string[];
    partnersCount: number;
}

interface AuthContextType {
    user: User | null;
    profile: UserProfile | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    loginWithEmail: (email: string, pass: string) => Promise<void>;
    signupWithEmail: (email: string, pass: string) => Promise<void>;
    signOut: () => Promise<void>;
    updateUserProfile: (displayName: string, username: string, photoURL: string, bio?: string, artStyles?: string[]) => Promise<void>;
    setProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    profile: null,
    loading: true,
    signInWithGoogle: async () => { },
    loginWithEmail: async () => { },
    signupWithEmail: async () => { },
    signOut: async () => { },
    updateUserProfile: async () => { },
    setProfile: () => { }
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                // Fetch or create user profile in Firestore
                const userDocRef = doc(db, 'users', currentUser.uid);
                const userDoc = await getDoc(userDocRef);

                if (userDoc.exists()) {
                    const data = userDoc.data() as UserProfile;

                    // Self-healing: verify and fix partner count mismatch
                    try {
                        const q1 = query(collection(db, 'partnerships'), where('user1', '==', currentUser.uid), where('status', '==', 'accepted'));
                        const q2 = query(collection(db, 'partnerships'), where('user2', '==', currentUser.uid), where('status', '==', 'accepted'));
                        const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
                        const actualCount = s1.size + s2.size;

                        if (actualCount !== data.partnersCount) {
                            await updateDoc(userDocRef, { partnersCount: actualCount });
                            data.partnersCount = actualCount;
                        }
                    } catch (e) {
                        console.error("Failed to verify partner count", e);
                    }

                    setProfile(data);
                } else {
                    // Create new profile for first-time user
                    const defaultUsername = `user${currentUser.uid.substring(0, 8)}`;
                    const newProfile: UserProfile = {
                        uid: currentUser.uid,
                        email: currentUser.email,
                        displayName: currentUser.displayName || 'Anonymous Artist',
                        username: defaultUsername,
                        usernameLowercase: defaultUsername.toLowerCase(),
                        photoURL: currentUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.uid}`,
                        bio: '',
                        artStyles: [],
                        partnersCount: 0,
                        createdAt: serverTimestamp()
                    } as any; // Cast added to bypass strict property checks on serverTimestamp for now

                    await setDoc(userDocRef, newProfile);
                    setProfile(newProfile);
                }
            } else {
                setProfile(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Error signing in with Google", error);
            throw error;
        }
    };

    const loginWithEmail = async (email: string, pass: string) => {
        try {
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (error) {
            console.error("Error logging in with email", error);
            throw error;
        }
    };

    const signupWithEmail = async (email: string, pass: string) => {
        try {
            await createUserWithEmailAndPassword(auth, email, pass);
        } catch (error) {
            console.error("Error signing up with email", error);
            throw error;
        }
    };

    const signOut = async () => {
        try {
            await firebaseSignOut(auth);
        } catch (error) {
            console.error("Error signing out", error);
            throw error;
        }
    };

    const updateUserProfile = async (displayName: string, newUsername: string, photoURL: string, bio: string = '', artStyles: string[] = []) => {
        if (!user || !profile) return;
        try {
            const updates: any = { displayName, photoURL, bio, artStyles };

            // Handle username changes
            let changingUsername = false;
            let finalUsername = profile.username;
            let finalUsernameLowercase = profile.usernameLowercase;

            if (newUsername && newUsername !== profile.username) {
                // Check 3-day cooldown
                if (profile.lastUsernameChange) {
                    const lastChangeDate = profile.lastUsernameChange.toDate ? profile.lastUsernameChange.toDate() : new Date(profile.lastUsernameChange);
                    const daysSinceChange = (Date.now() - lastChangeDate.getTime()) / (1000 * 60 * 60 * 24);
                    if (daysSinceChange < 3) {
                        throw new Error(`You can only change your username every 3 days. Please wait.`);
                    }
                }

                // Check uniqueness
                const lowercaseNew = newUsername.toLowerCase();
                const usersRef = collection(db, 'users');
                const q = query(usersRef, where('usernameLowercase', '==', lowercaseNew));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    throw new Error("This username is already taken.");
                }

                updates.username = newUsername;
                updates.usernameLowercase = lowercaseNew;
                updates.lastUsernameChange = serverTimestamp();
                changingUsername = true;
                finalUsername = newUsername;
                finalUsernameLowercase = lowercaseNew;
            }

            // Update Firestore
            const userDocRef = doc(db, 'users', user.uid);
            await setDoc(userDocRef, updates, { merge: true });

            // Update local state
            setProfile({
                ...profile,
                displayName,
                photoURL,
                bio,
                artStyles,
                ...(changingUsername && {
                    username: finalUsername,
                    usernameLowercase: finalUsernameLowercase,
                    // Use Date.now() locally as a placeholder since serverTimestamp() is evaluated on the server
                    lastUsernameChange: { toDate: () => new Date() }
                })
            });
        } catch (error) {
            console.error("Error updating profile", error);
            throw error;
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            profile,
            loading,
            signInWithGoogle,
            signOut,
            updateUserProfile,
            setProfile,
            loginWithEmail,
            signupWithEmail
        }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
