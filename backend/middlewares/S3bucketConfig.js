import { S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
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
        const baseUrl = url.split("?")[0];
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

export const deleteS3Object = async (fileUrl) => {
    let key = null; // <<< Declare key outside the try block using let

    try {
        // BASIC URL FORMAT VALIDATION (Optional based on s3KeyFromUrl robustness)
        // if (!fileUrl || typeof fileUrl !== 'string' /*|| !fileUrl.startsWith(`https://${process.env.BUCKET_NAME}.s3.`)*/) {
        //      console.warn(`[S3 Helper] Skipping deletion for invalid input URL: ${fileUrl}`);
        //     return;
        // }

        key = s3KeyFromUrl(fileUrl); 
        if (key && key.trim() !== '') {
             const decodedKey = decodeNestedKey(key);

            const deleteParams = {
                Bucket: process.env.BUCKET_NAME,
                Key: decodedKey,
            };
            console.log(`[S3 Helper] Attempting to delete S3 object with decoded key: ${decodedKey}`);
            await s3.send(new DeleteObjectCommand(deleteParams));
            console.log(`[S3 Helper] Successfully deleted S3 object with decoded key: ${decodedKey}`);
        } else {
             console.warn(`[S3 Helper] Could not extract a valid key from URL: ${fileUrl}`);
        }
    } catch (error) {
        const decodedKeyInfo = key ? decodeNestedKey(key) : "N/A";
        const keyInfoForLog = key ? `'${decodedKeyInfo}' (decoded) derived from ${fileUrl}` : `from URL ${fileUrl} (key extraction may have failed)`;

        if (error.name === 'NoSuchKey') {
            console.warn(`[S3 Helper] S3 object key not found during deletion attempt (NoSuchKey): ${keyInfoForLog}`);
        } else {
            console.error(`[S3 Helper] Failed to delete S3 object with key ${keyInfoForLog}:`, error);
            throw error;
        }
    }
};


export default {s3, generateS3Url, s3KeyFromUrl, decodeNestedKey, deleteS3Object}