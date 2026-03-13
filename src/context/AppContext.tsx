import React, { createContext, useContext, useState, useEffect } from 'react';

// Theme Types
export type ThemeId = 'peach_dream' | 'neon_nights' | 'minimalist_white' | 'forest_calm';

export type FontId = 'playfair' | 'inter' | 'cinzel' | 'pixel' | 'caveat' | 'creepster';

export const FONTS: Record<FontId, { name: string, family: string }> = {
    playfair: { name: 'Playfair (Default)', family: "'Playfair Display', serif" },
    inter: { name: 'Inter (Modern)', family: "'Inter', sans-serif" },
    cinzel: { name: 'Cinzel (Serif)', family: "'Cinzel', serif" },
    pixel: { name: 'Press Start (Pixel)', family: "'Press Start 2P', cursive" },
    caveat: { name: 'Caveat (Handwriting)', family: "'Caveat', cursive" },
    creepster: { name: 'Creepster (Horror)', family: "'Creepster', cursive" }
};

export interface ThemeColors {
    background: string;
    text: string;
    primary: string;
    surface: string;
    border: string;
    light1: string; // Neon accent 1
    light2: string; // Neon accent 2
    light3: string; // Neon accent 3
}

export const THEMES: Record<ThemeId, { name: string, description: string, colors: ThemeColors }> = {
    peach_dream: {
        name: 'Peach Dream',
        description: 'Warm, inviting peach gradient tones.',
        colors: {
            background: '#f594a6',
            text: '#3c2a2b',
            primary: '#fcd7c6',
            surface: 'rgba(255, 255, 255, 0.4)',
            border: 'rgba(255, 255, 255, 0.4)',
            light1: '#ffffff',
            light2: '#fcaab8',
            light3: '#ffffff'
        }
    },
    neon_nights: {
        name: 'Neon Nights',
        description: 'Dark mode, bright neon artworks and accents.',
        colors: {
            background: '#010030',
            text: '#ffe5f1',
            primary: '#160078',
            surface: 'rgba(255, 255, 255, 0.1)',
            border: 'rgba(255, 255, 255, 0.2)',
            light1: '#87f5f5',  // Cyan
            light2: '#f042ff',  // Magenta
            light3: '#7226ff'   // Purple
        }
    },
    minimalist_white: {
        name: 'Minimalist White',
        description: 'Clean rooms, art walls, and bright spaces.',
        colors: {
            background: '#f8f9fa',
            text: '#212529',
            primary: '#e9ecef',
            surface: 'rgba(255, 255, 255, 0.8)',
            border: 'rgba(0, 0, 0, 0.1)',
            light1: '#ffffff',
            light2: '#e9ecef',
            light3: '#ffffff'
        }
    },
    forest_calm: {
        name: 'Forest Calm',
        description: 'Serene greens, earth tones, and browns.',
        colors: {
            background: '#8da68f',
            text: '#2c3a2f',
            primary: '#b2c9b4',
            surface: 'rgba(255, 255, 255, 0.4)',
            border: 'rgba(255, 255, 255, 0.3)',
            light1: '#ffffff',
            light2: '#c9e0cb',
            light3: '#f0f5f1'
        }
    }
};

// Data Types
export interface Artwork {
    id: string;
    url: string; // Used as the base URL for the media
    title: string;
    likes: number;
    comments: number;

    // New Phase 1 Properties
    mediaType?: 'image' | 'video' | '3d';
    medium?: string;
    dimensions?: string;
    price?: string;
    artistStatement?: string;

    // 3D Transform Properties (for Edit Mode)
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: [number, number, number];
}

export interface Gallery {
    id: string;
    userId: string;
    name: string;
    artworks: Artwork[];
}

export interface Profile {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string;
    bio: string;
}

export interface UserContextType {
    name: string;
    avatarUrl: string;
    themeId: ThemeId;
    theme: ThemeColors;
    fontId: FontId;
    fontFamily: string;
    setThemeId: (theme: ThemeId) => void;
    setFontId: (font: FontId) => void;
    setName: (name: string) => void;
    setAvatarUrl: (url: string) => void;

    // Legacy Mock Data Management (To be replaced)
    myGallery: Gallery;
    addArtwork: (url: string, title: string) => void;
    removeArtwork: (id: string) => void;
}

const defaultContext: UserContextType = {
    name: 'Creator',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    themeId: 'peach_dream',
    theme: THEMES.peach_dream.colors,
    fontId: 'playfair',
    fontFamily: FONTS.playfair.family,
    setThemeId: () => { },
    setFontId: () => { },
    setName: () => { },
    setAvatarUrl: () => { },
    myGallery: { id: 'mine', userId: 'Creator', name: 'My Gallery', artworks: [] },
    addArtwork: () => { },
    removeArtwork: () => { }
};

const AppContext = createContext<UserContextType>(defaultContext);

export const useAppContext = () => useContext(AppContext);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [name, setName] = useState('Creator');
    const [avatarUrl, setAvatarUrl] = useState('https://api.dicebear.com/7.x/avataaars/svg?seed=Felix');
    const [themeId, setThemeId] = useState<ThemeId>('peach_dream');
    const [fontId, setFontId] = useState<FontId>('playfair');

    // Default Mock Gallery
    const [myGallery, setMyGallery] = useState<Gallery>({
        id: 'mock-1',
        userId: 'Creator',
        name: 'My Gallery',
        artworks: [
            { id: '1', url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=1000&auto=format&fit=crop', title: 'Digital Abstract', likes: 16550, comments: 243 },
            { id: '2', url: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=1000&auto=format&fit=crop', title: 'Neon Dreams', likes: 8200, comments: 120 },
            { id: '3', url: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?q=80&w=1000&auto=format&fit=crop', title: 'Mountain Lake', likes: 4500, comments: 80 }
        ]
    });

    useEffect(() => {
        const storedName = localStorage.getItem('artspace_user_name');
        const storedAvatar = localStorage.getItem('artspace_user_avatar');
        const storedTheme = localStorage.getItem('artspace_theme') as ThemeId;
        const storedFont = localStorage.getItem('artspace_font') as FontId;
        const storedGallery = localStorage.getItem('artspace_gallery');

        if (storedName) setName(storedName);
        if (storedAvatar) setAvatarUrl(storedAvatar);
        if (storedTheme && THEMES[storedTheme]) setThemeId(storedTheme);
        if (storedFont && FONTS[storedFont]) setFontId(storedFont);
        if (storedGallery) {
            try {
                setMyGallery(JSON.parse(storedGallery));
            } catch (e) {
                console.error("Failed to parse local stored gallery");
            }
        }
    }, []);

    // Effect to apply font globally
    useEffect(() => {
        document.body.style.fontFamily = FONTS[fontId].family;
    }, [fontId]);

    const handleSetName = (newName: string) => {
        setName(newName);
        localStorage.setItem('artspace_user_name', newName);
    };

    const handleSetAvatar = (newAvatar: string) => {
        setAvatarUrl(newAvatar);
        localStorage.setItem('artspace_user_avatar', newAvatar);
    };

    const handleSetTheme = (newTheme: ThemeId) => {
        setThemeId(newTheme);
        localStorage.setItem('artspace_theme', newTheme);
    };

    const handleSetFont = (newFont: FontId) => {
        setFontId(newFont);
        localStorage.setItem('artspace_font', newFont);
    };

    const addArtwork = (url: string, title: string) => {
        const newArt = { id: Date.now().toString(), url, title, likes: 0, comments: 0 };
        const updatedGallery = { ...myGallery, artworks: [...myGallery.artworks, newArt] };
        setMyGallery(updatedGallery);
        localStorage.setItem('artspace_gallery', JSON.stringify(updatedGallery));
    };

    const removeArtwork = (id: string) => {
        const updatedGallery = { ...myGallery, artworks: myGallery.artworks.filter(a => a.id !== id) };
        setMyGallery(updatedGallery);
        localStorage.setItem('artspace_gallery', JSON.stringify(updatedGallery));
    };

    return (
        <AppContext.Provider value={{
            name,
            avatarUrl,
            themeId,
            theme: THEMES[themeId].colors,
            fontId,
            fontFamily: FONTS[fontId].family,
            setThemeId: handleSetTheme,
            setFontId: handleSetFont,
            setName: handleSetName,
            setAvatarUrl: handleSetAvatar,
            myGallery,
            addArtwork,
            removeArtwork
        }}>
            {children}
        </AppContext.Provider>
    );
};
