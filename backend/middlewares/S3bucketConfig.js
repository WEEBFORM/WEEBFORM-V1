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

//GENERATE SIGNED S3 KEYS FOR OBJECTS
export const generateS3Url = async (key) => {
    if (!key) return null;
    const command = new GetObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: key,
    });
    return await getSignedUrl(s3, command);
};

// EXTRACT S3 KEYS
export const s3KeyFromUrl = (url) => {
    if (url && typeof url === "string") {
        const baseUrl = url.split("?")[0]; // Remove query parameters
        const key = baseUrl.replace(`https://${process.env.BUCKET_NAME}.s3.${process.env.BUCKET_REGION}.amazonaws.com/`, "");
        return key || null;
    }
    return null;
};

// DECODE NESTED OR DOUBLE ENCODED KEYS
export const decodeNestedKey = (key) => {
    try {
        return decodeURIComponent(key);
    } catch {
        return key;
    }
};

export default {s3, generateS3Url, s3KeyFromUrl, decodeNestedKey}