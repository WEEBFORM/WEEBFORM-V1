import { GoogleGenerativeAI } from "@google/generative-ai";
import { getFreshAnimeNews } from "./newsAggregatorService.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const PostScenarios = [
    {
        type: "Quick Take",
        prompt: (topic) => `Write a quick, casual opinion about "${topic}". Keep it short and punchy. Say what you think without overthinking it.`
    }, 
    {
        type: "Simple Like",
        prompt: (topic) => `Write a short post about why "${topic}" is good. Just be straightforward about it.`
    },
    {
        type: "Simple Dislike",
        prompt: (topic) => `Write a short post about why "${topic}" didn't work for you. Keep it real but not so mean.`
    },
    {
        type: "Question",
        prompt: (topic) => `Ask a simple question about "${topic}". Get people talking about it.`
    },
    {
        type: "Comparison",
        prompt: (topic) => `Compare "${topic}" to something similar. Which one's better and why?`
    },
    {
        type: "Hype",
        prompt: (topic) => `Get hyped about "${topic}". Why should people check it out?`
    },
    {
        type: "Funny Take",
        prompt: (topic) => `Make a funny, lighthearted joke about "${topic}". Keep it chill.`
    },
    {
        type: "Character Comment",
        prompt: (topic) => `Talk about a character from "${topic}". Do you like them or not, and why?`
    },
    {
        type: "Scene Reaction",
        prompt: (topic) => `React to a scene or moment from "${topic}". What stood out to you?`
    },
    {
        type: "Unpopular",
        prompt: (topic) => `Share an unpopular opinion about "${topic}". What do you think most people get wrong?`
    }
];

// GENERATES A BOT POST BASED ON ITS CORE PROMPT AND A RANDOM TOPIC
export const generateBotPost = async (botCorePrompt) => {
    let topic;
    try {
        const topics = await getFreshAnimeNews();
        if (topics.length === 0) {
            throw new Error("No fresh anime topics could be fetched.");
        }
        
        topic = topics[Math.floor(Math.random() * topics.length)];
        const scenario = PostScenarios[Math.floor(Math.random() * PostScenarios.length)];

        console.log(`LLM Service: Generating a "${scenario.type}" post for topic "${topic.title}"`);

        const wordCount = 30 + Math.floor(Math.random() * 50);

        const styleConstraints = `
                KEEP IT SHORT AND SIMPLE:
                - Write like a real person texting, not an essay
                - Use simple words. No fancy language.
                - Word count: around ${wordCount} words
                - Just say what you think. That's it.
                - One idea per post, not multiple ideas
                - Don't use phrases like "honestly", "let me tell you", "so basically"
                - No hashtags in the post itself - add them at the end only
                - Be yourself. Don't be generic.
                `;

        const fullPrompt = `
                You are this person:
                ${botCorePrompt}

                ${scenario.prompt(topic.title)}

                ${styleConstraints}

                Write ONLY the post itself, nothing else:
            `;

        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        let postText = response.text().trim();

        // Remove any accidental hashtags from the post body
        postText = postText.split('\n\n')[0].trim();

        // Add 2-3 hashtags at the end
        const hashtagCount = Math.floor(Math.random() * 2) + 2;
        const hashtagOptions = [
            "#anime", "#manga", "#animecommunity", "#otaku", "#weeb",
            "#anime", "#animereview", "#animethoughts", "#mangareader",
            "#seasonalanime", "#animelife", "#animefan", "#weebform", "#theweebsocial"
        ];
        
        const shuffled = hashtagOptions.sort(() => 0.5 - Math.random());
        const selectedTags = shuffled.slice(0, hashtagCount).join(" ");
        
        postText += `\n\n${selectedTags}`;

        return postText;

    } catch (error) {
        console.error("Error generating bot post:", error.message);
        const fallbackPosts = [
            `${topic?.title || "this anime"} is actually pretty good. way better than I thought it'd be #anime #animefan`,
            `nah ${topic?.title || "this one"} just didn't do it for me. pacing felt weird #anime #animethoughts`,
            `why is nobody talking about ${topic?.title || "this"}? it's way underrated #animecommunity #weeb`,
            `${topic?.title || "this anime"} had one scene that made it worth watching alone #animelife`,
            `so is anyone watching ${topic?.title || "this"} or just me? what do yall think? #animetwt`
        ];
        return fallbackPosts[Math.floor(Math.random() * fallbackPosts.length)];
    }
};

// GENERATES A BOT COMMENT BASED ON ITS CORE PROMPT AND THE ORIGINAL POST CONTENT
export const generateBotComment = async (botCorePrompt, originalPostContent) => {
    try {
        // Simple comment types
        const commentTypes = [
            "Agree with them and add one small thing",
            "Disagree but keep it friendly",
            "Ask them one follow-up question",
            "Say a short reaction to what they said",
            "Add one detail they missed"
        ];
        
        const commentType = commentTypes[Math.floor(Math.random() * commentTypes.length)];
        const wordCount = 10 + Math.floor(Math.random() * 20); // 10-30 words

        const fullPrompt = `
You are this person:
${botCorePrompt}

Someone posted: "${originalPostContent}"

Comment type: ${commentType}

RULES:
- Keep it SHORT. Like 10-30 words.
- Use simple words only.
- Sound like a real person, not a bot.
- Reference what they said specifically.
- No phrases like "literally", "honestly", "no cap", "facts", "period"
- Just be chill and natural.

Write ONLY the comment:
`;

        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        return response.text().trim();
    } catch (error) {
        console.error("Error generating bot comment:", error);
        const fallbacks = [
            "yeah that makes sense actually",
            "fair point, didn't think about it that way",
            "agree with this take",
            "nah but I kinda see where you're coming from",
            "this right here. thank you",
            "honestly that's facts",
            "same, felt the same way",
            "not wrong there"
        ];
        return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }
};