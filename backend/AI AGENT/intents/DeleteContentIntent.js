import BANNED_KEYWORDS from "../core/BannedKeywords.js";
import { s3, s3KeyFromUrl, decodeNestedKey } from "../../middlewares/S3bucketConfig.js";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

class DeleteContentIntent {
    constructor(databaseConnector) {
        this.databaseConnector = databaseConnector;
        this.bannedKeywords = BANNED_KEYWORDS;
    }

    async execute(message, userId) {
        // Admin check - use separate helper method to check for this
        if (!await this.checkUserPermission(userId, 'admin')) {
            return "Gomen nasai! Only admins can perform content deletion operations.";
        }

        // Extract keywords/phrases with improved regex
        const phraseMatch = message.match(/content\s+containing\s+["']([^"']+)["']/i) ||
            message.match(/delete\s+posts\s+with\s+["']([^"']+)["']/i) ||
            message.match(/remove\s+content\s+with\s+["']([^"']+)["']/i);

        const phrase = phraseMatch?.[1]?.trim();

        if (!phrase) {
            return "Please specify what content you want to delete by putting the phrase in quotes.";
        }

        // Safety check - don't allow overly broad deletions
        if (phrase.length < 3) {
            return "That search term is too short and might delete too much content. Please use a more specific phrase (at least 3 characters).";
        }

        // Construct the query with proper parameterization
        const query = `DELETE FROM posts WHERE description LIKE ?`;
        const phraseParam = `%${phrase}%`;

        try {
            const results = await this.databaseConnector.query(query, [phraseParam]);

            const deletedCount = results.affectedRows || 0;
            const responseMessage = deletedCount > 0
                ? `Mission complete! Deleted ${deletedCount} posts containing "${phrase}".`
                : `No posts found containing "${phrase}". Nothing to delete!`;

            return responseMessage;
        } catch (error) {
            console.error("Database query error:", error);
            return "Error deleting content.";
        }
    }

    async checkContent(description) {
        if (!description) return false;
        return this.bannedKeywords.some(keyword =>
            description.toLowerCase().includes(keyword.toLowerCase())
        );
    }

    async checkContentAndPotentiallyDelete(postId) {
        try {
            const query = `SELECT description, media FROM posts WHERE id = ?`;
            const results = await this.databaseConnector.query(query, [postId]);

            if (!results || results.length === 0) {
                console.log(`Post with ID ${postId} not found.`);
                return;
            }

            const post = results[0];
            const postDescription = post.description;
            const mediaUrls = post.media ? post.media.split(",") : [];

            let containsBannedKeyword = this.checkContent(postDescription);
            if (containsBannedKeyword) {
                console.log(`Post ${postId} contains banned keywords. Deleting...`);
                await this.deletePost(postId, mediaUrls);
            }
        } catch (error) {
            console.error("Error checking content and potentially deleting:", error);
        }
    }

    async deletePost(postId, mediaUrls) {
        try {
            if (mediaUrls && mediaUrls.length > 0) {
                for (const mediaUrl of mediaUrls) {
                    try {
                        const key = s3KeyFromUrl(mediaUrl);
                        if (key) {
                            const deleteParams = { Bucket: process.env.BUCKET_NAME, Key: key };
                            await s3.send(new DeleteObjectCommand(deleteParams));
                            console.log("S3 object deleted successfully:", key);
                        } else {
                            console.warn("Invalid S3 URL, skipping deletion:", mediaUrl);
                        }
                    } catch (s3Error) {
                        console.error("S3 deletion error for URL:", mediaUrl, s3Error);
                    }
                }
            }

            const query = `DELETE FROM posts WHERE id = ?`;
            await this.databaseConnector.query(query, [postId]);
            console.log(`Post ${postId} deleted due to containing banned keywords.`);
        } catch (error) {
            console.error("Error deleting post:", error);
        }
    }

    async checkUserPermission(userId, requiredRole) {
        return new Promise((resolve, reject) => {
            const query = "SELECT role FROM users WHERE id = ?";
            db.query(query, [userId], (err, results) => {
                if (err || results.length === 0) {
                    resolve(false);
                    return;
                }

                const userRole = results[0].role;
                resolve(userRole === requiredRole || userRole === 'superadmin');
            });
        });
    }
}

export default DeleteContentIntent;