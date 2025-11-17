import { GoogleGenerativeAI } from "@google/generative-ai";
// --- FIX: Use import for axios at the top level ---
import axios from 'axios';
import { resizeImageForReels } from '../middlewares/cloudfrontConfig.js'; // Import the resizing function

// --- FIX: Upgrade to a model that supports video/image generation ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// --- NEW: More realistic and varied post scenarios ---
const PostScenarios = [
    // Existing Gen-Z style for variety
    { prompt: (topic) => `${topic} literally lives in my head rent-free. the animation style and the story just hit different from everything else this season. it's a must-watch fr fr.` },
    // New, more descriptive scenario
    { prompt: (topic) => `Just finished the latest episode of ${topic} and I'm not okay. The character development for the protagonist is some of the best I've seen in a while. The emotional weight of that final scene was perfectly executed.` },
    // New question-based scenario
    { prompt: (topic) => `Okay, we need to talk about the world-building in ${topic}. How did they manage to create such a detailed and immersive setting? I have so many questions about the lore and what's coming next.` },
    // New comparative scenario
    { prompt: (topic) => `I'm calling it now: ${topic} is the dark horse of the season. It might not have the most hype, but its storytelling is so much more compelling and original than some of the bigger titles airing right now.` },
    // New contrarian take
    { prompt: (topic) => `Unpopular opinion maybe, but I feel like ${topic} is being a bit overrated. While the art is gorgeous, the pacing feels really inconsistent to me. Am I the only one feeling this way or am I missing something?` }
];

// --- NEW: Generates either a video or an image for a topic ---
const generateMediaForTopic = async (topic, postContent) => {
    // 15% chance to generate a video, otherwise generate an image
    const generateVideo = Math.random() < 0.15;
    
    let prompt;
    if (generateVideo) {
        console.log(`LLM Service: Generating AI video for "${topic}"...`);
        prompt = `Create a short, 5-second, seamlessly looping, dynamic video in the style of a high-energy anime music video (AMV) about "${topic}". Use dramatic zooms, quick cuts, and impactful scenes. NO text overlays. Focus on action or emotion. Vertical 9:16 aspect ratio.`;
    } else {
        console.log(`LLM Service: Generating AI image for "${topic}"...`);
        prompt = `Generate a stunning, high-quality vertical 9:16 anime artwork for "${topic}". Context: "${postContent}". The style should be like a professional anime poster, with rich colors, excellent composition, and high detail, capturing the essence of the series.`;
    }

    try {
        const result = await model.generateContent([prompt]);
        const response = await result.response;
        const part = response.candidates?.[0]?.content?.parts?.[0];

        // This is the "Nano Banana" part - extracting generated file data
        if (part && part.fileData) {
            const { mimeType, fileUri } = part.fileData;
            console.log(`LLM Service: Successfully generated ${mimeType} at temporary URI.`);
            // Fetch the media from Google's temporary storage
            const mediaResponse = await axios.get(fileUri, { responseType: 'arraybuffer' });
            let mediaBuffer = Buffer.from(mediaResponse.data);

            // If it's an image, apply the reels resizing
            if (mimeType.startsWith('image/')) {
                console.log(`LLM Service: Resizing generated image for reels format...`);
                mediaBuffer = await resizeImageForReels(mediaBuffer, 1080, 1920);
            }
            
            return { mediaBuffer, mediaType: mimeType };
        }
        throw new Error("No fileData returned from Gemini.");
    } catch (error) {
        console.error(`LLM Service: Media generation failed for "${topic}":`, error.message);
        return null;
    }
};

// ... (isHighQualityImageUrl and fetchHighQualityImage helpers remain the same, but the require bug is now fixed) ...

// GENERATES A BOT POST
export const generateBotPost = async (botCorePrompt, topic) => {
    try {
        if (!topic || !topic.title) {
            throw new Error("No topic was provided.");
        }
        
        const scenario = PostScenarios[Math.floor(Math.random() * PostScenarios.length)];
        console.log(`LLM Service: Generating post for topic "${topic.title}"`);

        // --- FIX: Increased word count and improved prompt ---
        const styleConstraints = `
            RULES:
            - Word count: MUST be between 25 and 40 words.
            - Write like a real, thoughtful fan. Use casual language but avoid excessive slang.
            - Focus on one clear idea.
            - Add 2-3 relevant hashtags at the very end, on a new line.
        `;

        const fullPrompt = `You are a persona: ${botCorePrompt}\n\nA new anime topic is: "${topic.title}"\n\nBased on your persona, write a social media post using this angle: "${scenario.prompt(topic.title)}"\n\n${styleConstraints}\n\nWrite ONLY the post content:`;

        const result = await model.generateContent(fullPrompt);
        let postText = (await result.response).text().trim();

        // --- Media Generation Logic ---
        let mediaResult = null;
        if (topic.imageUrl && isHighQualityImageUrl(topic.imageUrl)) {
            console.log(`LLM Service: Using high-quality provided image for "${topic.title}"`);
            mediaResult = { mediaUrl: topic.imageUrl, mediaType: 'image/jpeg' }; // Assume jpeg for URLs
        } else {
            // Fallback to AI generation if no good image is provided
            mediaResult = await generateMediaForTopic(topic.title, postText);
        }

        return { postText, media: mediaResult };

    } catch (error) {
        console.error("Error generating bot post:", error.message);
        // Fallback logic
        return { postText: `${topic?.title || "This anime"} is getting a lot of buzz. What are your thoughts on the latest season? #anime #discussion`, media: null };
    }
};

// ... (generateBotComment remains the same) ...