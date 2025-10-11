import sharp from 'sharp';
import dotenv from 'dotenv';

dotenv.config();

export const processImageUrl = (keyOrUrl) => {
    if (!keyOrUrl) {
        return null;
    }
    if (keyOrUrl.startsWith('http')) {
        return keyOrUrl;
    }
    return `https://${process.env.CLOUDFRONT_DOMAIN}/${keyOrUrl}`;
};

export const resizeImage = async (buffer, width, height) => {
    try {
        return await sharp(buffer)
            .resize(width, height)
            .webp({ quality: 80 })
            .toBuffer();
    } catch (error) {
        console.error("Error resizing image:", error);
        throw new Error("Failed to resize image");
    }
};