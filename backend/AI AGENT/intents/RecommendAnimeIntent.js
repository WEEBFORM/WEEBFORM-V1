import GeminiConnector from "../core/GeminiConnector.js";
import CacheManager from "../core/Cachemanager.js";

class RecommendAnimeIntent {
    constructor(geminiConnector, cacheManager) {
        this.geminiConnector = geminiConnector;
        this.cacheManager = cacheManager;
    }

    async execute(message) {
        try {
            // Extract any preferences from the message
            const genreMatch = message.match(/\b(action|adventure|comedy|drama|fantasy|horror|isekai|mecha|romance|sci-fi|slice of life|sports|supernatural)\b/gi);
            const genres = genreMatch ? [...new Set(genreMatch.map(g => g.toLowerCase()))] : [];

            // Check if age-related terms are mentioned
            const isAdult = /\b(adult|mature|18\+|seinen|ecchi|hentai)\b/i.test(message);
            const isKid = /\b(kids|children|child|family friendly|shounen|shōnen)\b/i.test(message);

            // Generate cache key based on preferences
            const cacheKey = `anime_rec_${genres.join('_')}_${isAdult ? 'adult' : ''}${isKid ? 'kid' : ''}`;

            // Check cache first
            const cachedRecs = this.cacheManager.get("animeCache", cacheKey);
            if (cachedRecs) {
                console.log("Serving anime recommendation from cache");
                return cachedRecs;
            }

            // Create a prompt that incorporates user preferences
            let prompt = "Recommend three anime titles with brief descriptions (30 words each). Include release year and genre.";

            if (genres.length > 0) {
                prompt += ` Focus on these genres: ${genres.join(', ')}.`;
            }

            if (isKid) {
                prompt += " Make sure these are family-friendly and appropriate for children.";
            } else if (isAdult) {
                prompt += " These can include mature themes, but do not recommend anything explicit or pornographic.";
            }

            prompt += " Format as a markdown list with anime titles in bold.";

            const response = await this.geminiConnector.generateContent(prompt);

            // Store the recommendations in the cache
            this.cacheManager.set("animeCache", cacheKey, response);
            console.log("Serving anime recommendation from Gemini and caching");

            return response;
        } catch (error) {
            console.error("Anime Recommendation Error:", error);
            return "Gomen! My anime knowledge database seems to be on cooldown. Try again in a bit!";
        }
    }
}

export default RecommendAnimeIntent;