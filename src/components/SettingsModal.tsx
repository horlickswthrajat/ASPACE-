import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Palette, Type } from 'lucide-react';
import { THEMES, FONTS, useAppContext } from '../context/AppContext';
import type { ThemeId, FontId } from '../context/AppContext';
import { getContrastColor } from '../utils/colorUtils';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type Tab = 'theme' | 'typography';

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const { themeId, setThemeId, fontId, setFontId } = useAppContext();
    const [activeTab, setActiveTab] = useState<Tab>('theme');
    const [previewThemeId, setPreviewThemeId] = useState<ThemeId>(themeId);
    const [previewFontId, setPreviewFontId] = useState<FontId>(fontId);

    // Reset previews when opened
    React.useEffect(() => {
        if (isOpen) {
            setPreviewThemeId(themeId);
            setPreviewFontId(fontId);
        }
    }, [isOpen, themeId, fontId]);

    const handleApply = () => {
        setThemeId(previewThemeId);
        setFontId(previewFontId);
        onClose();
    };

    const handleCancel = () => {
        setPreviewThemeId(themeId);
        setPreviewFontId(fontId);
        onClose();
    };

    if (!isOpen) return null;

    const previewColors = THEMES[previewThemeId].colors;

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 shadow-2xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ fontFamily: FONTS[previewFontId].family }}
            >
                {/* Dynamic Backdrop */}
                <div
                    className="absolute inset-0 transition-colors duration-500 backdrop-blur-md"
                    style={{ backgroundColor: `${previewColors.background}99` }}
                    onClick={handleCancel}
                />

                <motion.div
                    className="w-full max-w-3xl rounded-[2.5rem] p-8 relative z-10 flex flex-col items-center border shadow-2xl overflow-hidden min-h-[600px]"
                    initial={{ scale: 0.9, y: 20, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.9, y: 20, opacity: 0 }}
                    transition={{ type: "spring", bounce: 0.3 }}
                    style={{
                        backgroundColor: previewColors.surface,
                        borderColor: previewColors.border,
                        color: previewColors.text
                    }}
                >
                    <h2 className="text-3xl font-bold mb-6 tracking-tight self-start pl-4">App Settings</h2>

                    {/* Tabs */}
                    <div className="flex gap-4 w-full mb-8 border-b-2" style={{ borderColor: previewColors.border }}>
                        {(['theme', 'typography'] as Tab[]).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex items-center gap-2 pb-4 px-4 font-bold text-lg transition-colors border-b-4 ${activeTab === tab ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`}
                                style={{
                                    borderColor: activeTab === tab ? previewColors.primary : 'transparent',
                                    color: previewColors.text
                                }}
                            >
                                {tab === 'theme' ? <Palette size={20} /> : <Type size={20} />}
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>

                    <div className="w-full flex-1 overflow-y-auto pr-2 custom-scrollbar mb-8 flex flex-col gap-4">
                        {activeTab === 'theme' && (
                            <div className="flex flex-col gap-4">
                                {(Object.entries(THEMES) as [ThemeId, typeof THEMES[ThemeId]][]).map(([id, t]) => {
                                    const isSelected = previewThemeId === id;
                                    const tColors = t.colors;

                                    return (
                                        <motion.div
                                            key={id}
                                            onClick={() => setPreviewThemeId(id)}
                                            whileHover={{ scale: 1.02, x: 5 }}
                                            whileTap={{ scale: 0.98 }}
                                            className={`flex items-center justify-between p-5 rounded-3xl cursor-pointer transition-all border-2 ${isSelected ? 'border-transparent shadow-lg' : 'border-transparent opacity-80'}`}
                                            style={{
                                                backgroundColor: tColors.surface,
                                                color: tColors.text,
                                                borderColor: isSelected ? tColors.primary : tColors.border
                                            }}
                                        >
                                            <div className="flex flex-col gap-1">
                                                <h3 className="text-xl font-bold flex items-center gap-2">
                                                    {t.name}
                                                    {themeId === id && <span className="text-sm font-normal opacity-70">(Current)</span>}
                                                </h3>
                                                <p className="text-sm opacity-80 font-medium">{t.description}</p>
                                            </div>

                                            {/* Radio indicator */}
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors border-2`}
                                                style={{
                                                    borderColor: isSelected ? tColors.primary : tColors.text,
                                                    backgroundColor: isSelected ? tColors.primary : 'transparent'
                                                }}
                                            >
                                                {isSelected && <Check size={18} style={{ color: tColors.background }} strokeWidth={3} />}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}

                        {activeTab === 'typography' && (
                            <div className="grid grid-cols-2 gap-4">
                                {(Object.entries(FONTS) as [FontId, typeof FONTS[FontId]][]).map(([id, f]) => {
                                    const isSelected = previewFontId === id;

                                    return (
                                        <motion.div
                                            key={id}
                                            onClick={() => setPreviewFontId(id)}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            className={`flex flex-col p-6 rounded-3xl cursor-pointer transition-all border-2 ${isSelected ? 'shadow-lg' : 'opacity-80'}`}
                                            style={{
                                                backgroundColor: isSelected ? previewColors.primary : 'transparent',
                                                borderColor: isSelected ? previewColors.primary : previewColors.border,
                                                color: isSelected ? previewColors.background : previewColors.text
                                            }}
                                        >
                                            <h3 className="text-lg font-bold flex items-center justify-between mb-4">
                                                <span className="font-sans text-sm tracking-widest uppercase opacity-70">
                                                    {fontId === id ? 'Current' : 'Select'}
                                                </span>
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2`}
                                                    style={{
                                                        borderColor: isSelected ? previewColors.background : previewColors.border
                                                    }}
                                                >
                                                    {isSelected && <Check size={14} strokeWidth={4} />}
                                                </div>
                                            </h3>
                                            <div
                                                className="text-4xl text-center flex-1 flex items-center justify-center py-4"
                                                style={{ fontFamily: f.family }}
                                            >
                                                {f.name}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="flex gap-4 w-full mt-auto">
                        <button
                            onClick={handleCancel}
                            className="flex-1 py-4 rounded-2xl font-bold transition-all shadow-sm hover:shadow-md border"
                            style={{
                                backgroundColor: 'transparent',
                                color: previewColors.text,
                                borderColor: previewColors.border
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleApply}
                            className="flex-[2] py-4 rounded-2xl font-bold transition-all shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                            style={{
                                backgroundColor: previewColors.primary,
                                color: getContrastColor(previewColors.primary)
                            }}
                        >
                            Save Settings
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
