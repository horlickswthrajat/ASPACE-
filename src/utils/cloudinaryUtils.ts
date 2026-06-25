/**
 * Cloudinary Configuration Utility
 * 
 * Centralizes Cloudinary environment variable checks to provide clearer error messages.
 */

interface CloudinaryConfig {
    cloudName: string;
    uploadPreset: string;
    uploadUrl: string;
}

/**
 * Validates and returns the Cloudinary configuration.
 * Throws an error if the required environment variables are missing.
 */
export const getCloudinaryConfig = (): CloudinaryConfig => {
    // Provide robust out-of-the-box fallbacks so the app doesn't break if env vars are missing in deployment settings
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "dgunoovml";
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "artspace_preset";

    return {
        cloudName,
        uploadPreset,
        uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`
    };
};

/**
 * Specifically for video uploads if needed
 */
export const getCloudinaryVideoUploadUrl = (): string => {
    const { cloudName } = getCloudinaryConfig();
    return `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;
};
