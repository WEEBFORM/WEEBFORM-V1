// @ weebAI/intents/GeneralAppInfoIntent.js
import GeminiConnector from "../core/GeminiConnector.js";

class GeneralAppInfoIntent {
    constructor(geminiConnector) {
        this.geminiConnector = geminiConnector;
    }

    async execute(message) {
        try {
            // Extract what information is being asked about
            let topic = message.toLowerCase();

            // Check for common app info topics
            const presetResponses = {
                "rules": "# Community Rules\n\n1. Be respectful to all members\n2. No NSFW content outside designated communities\n3. No spam or excessive self-promotion\n4. Credit original content creators\n5. Keep discussions related to anime and community topics",

                "how to post": "# How to Post\n\n1. Navigate to any community page\n2. Click the '+' button in the bottom right\n3. Select post type (text, image, link)\n4. Add your content and any relevant tags\n5. Hit 'Post' and you're done!",

                "features": "# App Features\n\n- **Communities**: Join or create themed discussion groups\n- **Direct Messages**: Chat privately with other users\n- **Content Feed**: Personalized based on your interests\n- **Anime Database**: Search info on thousands of anime\n- **WeebAI**: That's me! Your friendly anime assistant",

                "about": "# About This App\n\nThis is an anime-focused social platform created for fans to connect, share content, and discover new anime. We've built this app with otaku culture in mind, providing specialized features for anime enthusiasts while maintaining a friendly community environment."
            };

            // Check if the message contains any of our preset topics
            for (const [key, value] of Object.entries(presetResponses)) {
                if (topic.includes(key)) {
                    return value;
                }
            }

            // If no preset matches, generate a response with Gemini
            const prompt = `
                As a helpful AI assistant for an anime-focused social media app, provide a concise, informative response to this user query.
                Make the response sound enthusiastic and use anime-themed language occasionally.
                Format the response in markdown. Keep it under 200 words.

                Query: ${message}
            `;

            const response = await this.geminiConnector.generateContent(prompt);
            return response;
        } catch (error) {
            console.error("General App Info Error:", error);
            return "Gomen nasai! I couldn't process your request right now. Please try again later!";
        }
    }
}

export default GeneralAppInfoIntent;