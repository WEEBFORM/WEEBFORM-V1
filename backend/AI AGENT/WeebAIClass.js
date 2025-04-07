import GeminiConnector from "./core/GeminiConnector.js";
import DatabaseConnector from "./core/DatabaseConnector.js";
import CacheManager from "./core/Cachemanager.js";
import BANNED_KEYWORDS from "./core/BannedKeywords.js";
import CommunityExistsIntent from "./intents/CommunityExistsIntent.js";
import UserPostCountIntent from "./intents/UserPostCountIntent.js";
import DeleteContentIntent from "./intents/DeleteContentIntent.js";
import RecommendAnimeIntent from "./intents/RecommendAnimeIntent.js";
import AnswerAnimeQuestionIntent from "./intents/AnswerAnimeQuestionIntent.js";
import GeneralAppInfoIntent from "./intents/GeneralAppInfoIntent.js";
import SearchAppDataIntent from "./intents/SearchAppDataIntent.js";
import ModActionsIntent from "./intents/ModActionsIntent.js";
import UserStatsIntent from "./intents/UserStatsIntent.js";
import TrendingPostsIntent from "./intents/TrendingPostsIntent.js";
import UnknownIntent from "./intents/UnknownIntent.js";
import AnimeResponses from "./responses/AnimeResponses.js";
import StringSanitizer from "./utils/StringSanitizer.js";

const apiKey = process.env.GEMINI_API_KEY

class WeebAI { 
    constructor(apiKey) {
        this.geminiConnector = new GeminiConnector(apiKey);
        this.databaseConnector = new DatabaseConnector();
        this.cacheManager = new CacheManager();
        this.stringSanitizer = new StringSanitizer();
        this.bannedKeywords = BANNED_KEYWORDS;
        this.animeResponses = AnimeResponses;

        this.intents = {
            community_exists: new CommunityExistsIntent(this.databaseConnector, this.cacheManager),
            user_post_count: new UserPostCountIntent(this.databaseConnector, this.cacheManager),
            delete_content: new DeleteContentIntent(this.databaseConnector),
            recommend_anime: new RecommendAnimeIntent(this.geminiConnector, this.cacheManager),
            answer_anime_question: new AnswerAnimeQuestionIntent(this.geminiConnector, this.cacheManager),
            general_app_info: new GeneralAppInfoIntent(this.geminiConnector),
            search_app_data: new SearchAppDataIntent(this.geminiConnector, this.databaseConnector),
            mod_actions: new ModActionsIntent(this.databaseConnector),
            user_stats: new UserStatsIntent(this.databaseConnector),
            trending_posts: new TrendingPostsIntent(this.databaseConnector),
            unknown: new UnknownIntent(),
        };
    }

    // Get random anime-themed response
    getRandomResponse(type) {
        const responses = this.animeResponses[type] || this.animeResponses.notUnderstood;
        return responses[Math.floor(Math.random() * responses.length)];
    }

    async processMessage(message, userId) {
        // Remove any potential SQL injection attempts
        message = this.stringSanitizer.sanitize(message);

        // Check for greeting patterns first
        if (this.isGreeting(message)) {
            return this.getRandomResponse("greeting");
        }

        // 1. Intent Recognition
        const intent = await this.recognizeIntent(message);
        console.log(`Recognized intent: ${intent} for message: ${message}`);

        // 2. Action based on intent
        try {
            if (this.intents[intent]) {
                return await this.intents[intent].execute(message, userId);
            } else {
                return this.getRandomResponse("notUnderstood");
            }
        } catch (error) { 
            console.error("Error processing message:", error);
            return "Gomen nasai! I encountered an error while processing your request. Please try again later.";
        }
    }
        isGreeting(message) {
        const greetingPatterns = [
            /^hi$/i, /^hello$/i, /^hey$/i, /^yo$/i, /^sup$/i,
            /^konnichiwa$/i, /^ohayo$/i, /^what's up$/i
        ];
        return greetingPatterns.some(pattern => pattern.test(message.trim()));
    }

    async recognizeIntent(message) {
        try {
            const prompt = `Determine the most appropriate intent category for this user message in an anime-themed social media app.

            Message: "${message}"

            Choose exactly one intent from these categories:
            - community_exists: User wants to know if a specific community exists
            - user_post_count: User wants to know how many posts a specific user has
            - delete_content: User wants to delete some content containing specific words/phrases
            - recommend_anime: User wants anime recommendations
            - answer_anime_question: User is asking a question about anime
            - general_app_info: User wants general information about the app
            - search_app_data: User wants to search for specific data in the app
            - mod_actions: User wants to perform moderation actions
            - user_stats: User wants statistics about users
            - trending_posts: User wants to know what posts are trending
            - unknown: Message doesn't fit any of the above categories

            Intent:`;

            const result = await this.geminiConnector.generateContent(prompt);
            const response = result.trim().toLowerCase();

            // Map the response to our intent categories
            const intentMap = {
                "community_exists": "community_exists",
                "user_post_count": "user_post_count",
                "delete_content": "delete_content",
                "recommend_anime": "recommend_anime",
                "answer_anime_question": "answer_anime_question",
                "general_app_info": "general_app_info",
                "search_app_data": "search_app_data",
                "mod_actions": "mod_actions",
                "user_stats": "user_stats",
                "trending_posts": "trending_posts"
            };

            for (const [key, value] of Object.entries(intentMap)) {
                if (response.includes(key)) {
                    return value;
                }
            }

            return "unknown";
        } catch (error) {
            console.error("Intent Recognition Error:", error);
            return "unknown";
        }
    }
}

export default WeebAI;