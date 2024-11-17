import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "dotenv";
config();

export const s3 = new S3Client({
    region: process.env.BUCKET_REGION,
    credentials: {
        accessKeyId: process.env.ACCESS_KEY,
        secretAccessKey: process.env.SECRET_ACCESS_KEY,
    },
});

// Helper function to generate signed URLs for S3 objects
export const generateS3Url = async (key) => {
    if (!key) return null;
    const command = new GetObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: key,
    });
    return await getSignedUrl(s3, command, { expiresIn: 3600 });
};

// Extract S3 key from URL
export const s3KeyFromUrl = (url) => {
    if (url && typeof url === "string") {
        const baseUrl = url.split("?")[0]; // Remove query parameters
        const key = baseUrl.replace(`https://${process.env.BUCKET_NAME}.s3.${process.env.BUCKET_REGION}.amazonaws.com/`, "");
        return key || null;
    }
    return null;
};

// Decode nested or double-encoded keys
export const decodeNestedKey = (key) => {
    try {
        return decodeURIComponent(key); // Handle double encoding
    } catch {
        return key;
    }
};

export default {s3, generateS3Url, s3KeyFromUrl, decodeNestedKey}