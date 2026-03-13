/**
 * Compresses an image file using HTML5 Canvas before uploading it.
 * This drastically reduces file size and Firebase Storage upload time.
 * 
 * @param file The original image File object
 * @param maxWidth The maximum width constraint for the image
 * @param quality JPEG compression quality (0 to 1)
 * @returns A Promise resolving to the compressed File
 */
export const compressImage = async (file: File, maxWidth: number = 1920, quality: number = 0.8): Promise<File> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;

            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Scale down if image is larger than maxWidth, maintaining aspect ratio
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return reject(new Error("Failed to get canvas context for image compression."));
                }

                // Draw the resized image to the canvas
                ctx.drawImage(img, 0, 0, width, height);

                // Convert canvas back to a Blob, then to a File
                canvas.toBlob((blob) => {
                    if (!blob) {
                        return reject(new Error("Canvas toBlob failed."));
                    }

                    // Replace extension with .jpg as we force jpeg conversion
                    const newFileName = file.name.replace(/\.[^/.]+$/, ".jpg");
                    const compressedFile = new File([blob], newFileName, {
                        type: 'image/jpeg',
                        lastModified: Date.now(),
                    });

                    resolve(compressedFile);
                }, 'image/jpeg', quality);
            };

            img.onerror = (error) => reject(error);
        };

        reader.onerror = (error) => reject(error);
    });
};
