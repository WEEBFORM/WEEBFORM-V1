// Handles community existence checks
import DatabaseConnector from "../core/DatabaseConnector.js";
import CacheManager from "../core/Cachemanager.js";

class CommunityExistsIntent {
    constructor(databaseConnector, cacheManager) {
        this.databaseConnector = databaseConnector;
        this.cacheManager = cacheManager;
    }

    async execute(message) {
        // Extract community name using regex
        const communityNameMatch = message.match(/community\s+["']?([^"']+)["']?\s+exist/i) ||
                                  message.match(/does\s+["']?([^"']+)["']?\s+community\s+exist/i) ||
                                  message.match(/is\s+there\s+a\s+["']?([^"']+)["']?\s+community/i);

        const communityName = communityNameMatch?.[1]?.trim();

        if (!communityName) {
            return "Hmm, which community are you asking about? Please specify a name!";
        }

        // Check cache first
        const cacheKey = `community_${communityName.toLowerCase()}`;
        const cachedResult = this.cacheManager.get("communityCache", cacheKey);
        if (cachedResult !== undefined) {
            console.log(`Serving community existence from cache for: ${communityName}`);
            return cachedResult;
        }

        // Query the database
        const query = "SELECT * FROM communities WHERE LOWER(title) = LOWER(?)";
        try {
            const results = await this.databaseConnector.query(query, [communityName]);

            let response;
            if (results.length > 0) {
                response = `Hai! The "${communityName}" community exists with ${results[0].memberCount || 'some'} members!`;
            } else {
                response = `Nope! The "${communityName}" community doesn't exist yet. Want to create it?`;
            }

            // Cache the result
            this.cacheManager.set("communityCache", cacheKey, response);
            return response;
        } catch (error) {
            console.error("Database query error:", error);
            return "Oops! I had trouble checking that community. Try again later?";
        }
    }
}

export default CommunityExistsIntent;