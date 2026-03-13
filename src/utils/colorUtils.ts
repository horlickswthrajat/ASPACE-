/**
 * Parses a hex color or rgb/rgba string and returns its relative luminance.
 * @param color The color string to parse
 * @returns The luminance value between 0 and 1
 */
function getLuminance(color: string): number {
    let r = 0, g = 0, b = 0;

    if (color.startsWith('#')) {
        let hex = color.substring(1);
        if (hex.length === 3) {
            hex = hex.split('').map(char => char + char).join('');
        }
        if (hex.length >= 6) {
            r = parseInt(hex.substring(0, 2), 16);
            g = parseInt(hex.substring(2, 4), 16);
            b = parseInt(hex.substring(4, 6), 16);
        }
    } else if (color.startsWith('rgb')) {
        const match = color.match(/\d+(\.\d+)?/g);
        if (match && match.length >= 3) {
            r = parseFloat(match[0]);
            g = parseFloat(match[1]);
            b = parseFloat(match[2]);
        }
    }

    // Convert to linear sRGB
    const sR = r / 255;
    const sG = g / 255;
    const sB = b / 255;

    const R = sR <= 0.03928 ? sR / 12.92 : Math.pow((sR + 0.055) / 1.055, 2.4);
    const G = sG <= 0.03928 ? sG / 12.92 : Math.pow((sG + 0.055) / 1.055, 2.4);
    const B = sB <= 0.03928 ? sB / 12.92 : Math.pow((sB + 0.055) / 1.055, 2.4);

    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * Returns a high-contrast text color (black or white) based on the background color luminance.
 * @param bgColor The background color (hex, rgb, rgba)
 * @returns '#ffffff' for dark backgrounds, '#1a1a1a' for light backgrounds.
 */
export function getContrastColor(bgColor: string): string {
    // Some of our themes use rgba strings for surface/border transparent overlays.
    // If it's highly transparent, the perceived background is usually the app background.
    // However, for solid colors (like primary buttons), this works perfectly.

    // Default fallback if parsing fails
    if (!bgColor) return '#ffffff';

    const luminance = getLuminance(bgColor);

    // W3C recommendation for contrast threshold is typically ~0.179
    return luminance > 0.179 ? '#1a1a1a' : '#ffffff';
}
