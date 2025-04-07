import { GoogleGenerativeAI } from "@google/generative-ai";

class GeminiConnector {
    constructor(apiKey, modelName = "gemini-pro") {
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: modelName });
    }

    async generateContent(prompt) {
        try {
            const result = await this.model.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            console.error("Gemini API Error:", error);
            throw new Error("Failed to generate content with Gemini API");
        }
    }
}

export default GeminiConnector;