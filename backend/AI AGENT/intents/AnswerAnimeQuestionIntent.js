// @ weebAI/intents/AnswerAnimeQuestionIntent.js
import GeminiConnector from "../core/GeminiConnector.js";
import CacheManager from "../core/Cachemanager.js";

class AnswerAnimeQuestionIntent {
    constructor(geminiConnector, cacheManager) {
        this.geminiConnector = geminiConnector;
        this.cacheManager = cacheManager;
    }

    async execute(message) {
        try {
            // Remove question words for caching
            const simplifiedQuestion = message.toLowerCase()
                .replace(/^(what|who|when|where|why|how|is|are|was|were|do|does|did|can|could|would|should)\s+/i, '')
                .replace(/\?+$/, '')
                .trim();

            // Create cache key
            const cacheKey = `anime_q_${simplifiedQuestion.substring(0, 50)}`;

            // Check cache first
            const cachedAnswer = this.cacheManager.get("animeCache", cacheKey);
            if (cachedAnswer) {
                console.log("Serving anime answer from cache");
                return cachedAnswer;
            }

            // Generate a prompt that encourages accurate anime knowledge
            const prompt = `
                As an anime expert, answer this question accurately and confidently:
                "${message}"

                If you're not sure about the answer, say so rather than making up information.
                Include at least one interesting fact related to the question.
                Use some light anime-themed language in your response.
                Format your answer in markdown.
            `;

            const response = await this.geminiConnector.generateContent(prompt);

            // Store the answer in the cache
            this.cacheManager.set("animeCache", cacheKey, response);
            console.log("Serving anime answer from Gemini and caching");

            return response;
        } catch (error) {
            console.error("Anime Question Error:", error);
            return "Nani?! I couldn't process your anime question. My knowledge database might be temporarily unavailable. Try again later!";
        }
    }
}

export default AnswerAnimeQuestionIntent;