import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Cropper from 'react-easy-crop';
import { X, Check } from 'lucide-react';
import getCroppedImg from '../utils/cropImage';
import { useAppContext } from '../context/AppContext';
import { getContrastColor } from '../utils/colorUtils';

interface ImageEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageFile: File | null;
    imageUrl?: string | null;
    onSave: (croppedFile: File) => void;
    aspectRatio?: number; // 1 for 1:1, 16/9, etc.
}

export default function ImageEditorModal({ isOpen, onClose, imageFile, imageUrl, onSave, aspectRatio = 1 }: ImageEditorModalProps) {
    const { theme } = useAppContext();
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    const imageSrc = React.useMemo(() => {
        if (imageFile) return URL.createObjectURL(imageFile);
        if (imageUrl) return imageUrl;
        return null;
    }, [imageFile, imageUrl]);

    const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleSave = async () => {
        if (!imageSrc || !croppedAreaPixels) return;

        try {
            const croppedFile = await getCroppedImg(
                imageSrc,
                croppedAreaPixels,
                rotation
            );
            if (croppedFile) {
                onSave(croppedFile);
            }
        } catch (e) {
            console.error(e);
            alert("Error cropping image");
        }
    };

    return (
        <AnimatePresence>
            {isOpen && imageSrc && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/80 backdrop-blur-md"
                        onClick={onClose}
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-2xl bg-[#0a0a0a] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/10"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/10 z-10 bg-[#0a0a0a]">
                            <h2 className="text-2xl font-black tracking-tight text-white">Edit Image</h2>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Cropper Area */}
                        <div className="relative w-full h-[50vh] min-h-[300px] bg-black/50">
                            <Cropper
                                image={imageSrc}
                                crop={crop}
                                zoom={zoom}
                                rotation={rotation}
                                aspect={aspectRatio}
                                onCropChange={setCrop}
                                onCropComplete={onCropComplete}
                                onZoomChange={setZoom}
                                onRotationChange={setRotation}
                            />
                        </div>

                        {/* Controls */}
                        <div className="p-6 bg-[#0a0a0a] flex flex-col gap-6 z-10 border-t border-white/10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Zoom Slider */}
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-bold text-gray-400">Zoom: {zoom.toFixed(1)}x</label>
                                    <input
                                        type="range"
                                        value={zoom}
                                        min={1}
                                        max={3}
                                        step={0.1}
                                        aria-labelledby="Zoom"
                                        onChange={(e) => setZoom(Number(e.target.value))}
                                        className="w-full"
                                        style={{ accentColor: theme.primary }}
                                    />
                                </div>
                                {/* Rotation Slider */}
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-bold text-gray-400">Rotation: {rotation}°</label>
                                    <input
                                        type="range"
                                        value={rotation}
                                        min={0}
                                        max={360}
                                        step={1}
                                        aria-labelledby="Rotation"
                                        onChange={(e) => setRotation(Number(e.target.value))}
                                        className="w-full"
                                        style={{ accentColor: theme.primary }}
                                    />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-4 mt-2">
                                <button
                                    onClick={onClose}
                                    className="flex-1 py-3.5 rounded-2xl font-bold bg-white/5 border-2 border-transparent hover:bg-white/10 transition-colors text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="flex-1 py-3.5 rounded-2xl font-bold shadow-md transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                                    style={{ backgroundColor: theme.primary, color: getContrastColor(theme.primary) }}
                                >
                                    <Check size={20} />
                                    Apply Crop
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
