import DatabaseConnector from "../core/DatabaseConnector.js";
import CacheManager from "../core/Cachemanager.js";

class UserPostCountIntent {
    constructor(databaseConnector, cacheManager) {
        this.databaseConnector = databaseConnector;
        this.cacheManager = cacheManager;
    }

    async execute(message) {
        // Enhanced extraction of username
        const usernameMatch = message.match(/posts\s+does\s+@?([a-zA-Z0-9_]+)\s+have/i) ||
            message.match(/how\s+many\s+posts\s+does\s+@?([a-zA-Z0-9_]+)/i) ||
            message.match(/post\s+count\s+for\s+@?([a-zA-Z0-9_]+)/i);

        const username = usernameMatch?.[1]?.trim();

        if (!username) {
            return "Which user are you asking about? Please mention their username!";
        }

        // Check cache first
        const cacheKey = `post_count_${username.toLowerCase()}`;
        const cachedResult = this.cacheManager.get("userDataCache", cacheKey);
        if (cachedResult !== undefined) {
            console.log(`Serving user post count from cache for: ${username}`);
            return cachedResult;
        }

        // Query to the database
        const query = `
            SELECT COUNT(*) AS postCount,
                  (SELECT COUNT(*) FROM comments c JOIN users u2 ON u2.id = c.userId WHERE LOWER(u2.username) = LOWER(?)) AS commentCount
            FROM posts p
            JOIN users u ON u.id = p.userId
            WHERE LOWER(u.username) = LOWER(?)`;

        try {
            const results = await this.databaseConnector.query(query, [username, username]);

            let response;
            if (results.length > 0) {
                const postCount = results[0].postCount;
                const commentCount = results[0].commentCount || 0;

                // Anime-themed response based on count
                if (postCount > 100) {
                    response = `Sugoi! @${username} is a posting legend with ${postCount} posts and ${commentCount} comments! That's some serious dedication!`;
                } else if (postCount > 50) {
                    response = `Impressive! @${username} has shared ${postCount} posts and ${commentCount} comments. They're on their way to becoming a community hero!`;
                } else if (postCount > 0) {
                    response = `@${username} has made ${postCount} posts and ${commentCount} comments. Every journey begins with a single post!`;
                } else {
                    response = `@${username} hasn't posted anything yet. Maybe they're just shy?`;
                }
            } else {
                response = `I couldn't find a user called @${username}. Are you sure that's their correct username?`;
            }

            // Cache the result
            this.cacheManager.set("userDataCache", cacheKey, response);
            return response;
        } catch (error) {
            console.error("Database query error:", error);
            return "Error checking user post count.";
        }
    }
}

export default UserPostCountIntent;