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
            .resize({
                width,
                height,
                fit: 'cover'
            })
            .webp({ quality: 80 })
            .toBuffer();
    } catch (error) {
        console.error("Error resizing image:", error);
        throw new Error("Failed to resize image");
    }
};

export const resizeImageForReels = async (input, width, height) => {
    try {
        return sharp(input)
            .resize({
                width: width,
                height: height,
                fit: 'cover', 
                position: 'center'
            })
            .webp({ quality: 80 })
            .toBuffer();
    } catch (error) {
        console.error("Error resizing reel image:", error);
        throw new Error("Failed to resize reel image");
    }
};