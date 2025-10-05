import { GoogleGenerativeAI } from "@google/generative-ai";
import { getFreshAnimeNews } from "./newsAggregatorService.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Diverse opening styles - randomly selected
const OpeningStyles = [
    "", // No opening at all
    "Just finished watching",
    "So I've been thinking about",
    "Can we talk about",
    "Unpopular opinion:",
    "Hot take incoming:",
    "Real talk,",
    "Not gonna lie,",
    "I might be alone in this but",
    "Quick thoughts on",
    "Hear me out:",
    "Controversial take:",
    "Been rewatching",
    "Just discovered",
    "Why is nobody talking about",
    "Finally caught up with",
    "Started watching",
    "Finished binging",
    "Halfway through",
    "The more I think about"
];

// Diverse transition phrases
const TransitionPhrases = [
    "and honestly", "but here's the thing", "which got me thinking",
    "and it made me realize", "so naturally", "which is why",
    "because let's be real", "but seriously though", "and don't get me started on",
    "which brings me to", "and you know what", "but the thing is",
    "and I gotta say", "which is interesting because", "but wait",
    "and suddenly it hit me", "so of course", "but then again",
    "which is wild because", "and that's when", "but plot twist"
];

// Diverse emphasis styles
const EmphasisStyles = [
    "absolutely", "genuinely", "literally", "seriously", "actually",
    "honestly", "truly", "really", "definitely", "totally",
    "completely", "utterly", "massively", "incredibly", "insanely"
];

// Diverse question endings (not all posts need them)
const QuestionEndings = [
    "Thoughts?", "Anyone else?", "Just me?", "Am I crazy?",
    "What do you think?", "Change my mind.", "Agree or nah?",
    "Tell me I'm wrong.", "Who's with me?", "Fight me on this.",
    "Convince me otherwise.", "Someone back me up here.",
    "", "", "", "" // Many posts shouldn't end with questions
];

// Diverse emoji usage patterns (used sparingly and differently)
const EmojiPatterns = [
    [], // No emojis
    ["💀"], ["😭"], ["🔥"], ["✨"], ["👀"],
    ["💯"], ["😤"], ["🤔"], ["😂"], ["💀", "💀"],
    ["👌"], ["🙌"], ["😩"], ["🤷"], ["💪"]
];

const PostScenarios = [
    {
        type: "Hot Take",
        prompt: (topic) => `Write a spicy hot take about "${topic}". Challenge mainstream opinion. Make a bold claim that'll get people arguing in replies. Reference what's trending but disagree with the hype or defend something underrated.`
    }, 
    {
        type: "Nostalgic Rewatch",
        prompt: (topic) => `You rewatched "${topic}" recently. Compare it to current anime. Talk about what aged well or poorly. Mention a specific moment that hit different this time around.`
    },
    {
        type: "Open Discussion",
        prompt: (topic) => `Start a discussion about "${topic}". Ask something that doesn't have an obvious answer. Connect it to bigger themes or current events. Get people debating different perspectives.`
    },
    {
        type: "Unpopular Opinion",
        prompt: (topic) => `Share an opinion about "${topic}" that most fans would disagree with. Defend it with specific examples. Acknowledge it's controversial but stand by it.`
    },
    {
        type: "Character Analysis",
        prompt: (topic) => `Deep dive on a character from "${topic}". Either praise them as underrated or critique them as overrated. Focus on their arc, development, or specific decisions they made.`
    },
    {
        type: "Fan Theory",
        prompt: (topic) => `Present a theory about "${topic}". Build it up with evidence from the show. Speculate on implications. Invite others to debunk or expand on it.`
    },
    {
        type: "Enthusiastic Recommendation",
        prompt: (topic) => `Recommend "${topic}" enthusiastically. Describe what hooked you without spoilers. Compare it to similar shows. Explain who would love it and why.`
    },
    {
        type: "Humorous Critique",
        prompt: (topic) => `Make fun of something about "${topic}" in a lighthearted way. Roast a trope, plot hole, or character choice. Keep it playful, not mean-spirited.`
    },
    {
        type: "Personal Connection",
        prompt: (topic) => `Share how "${topic}" resonated with you personally. Talk about a specific scene or theme that reminded you of something in your life. Be vulnerable but not oversharing.`
    },
    {
        type: "Cultural Commentary",
        prompt: (topic) => `Connect "${topic}" to real-world issues, psychology, or culture. Analyze what it says about society. Make it thought-provoking beyond just entertainment.`
    },
    {
        type: "Prediction Post",
        prompt: (topic) => `Predict what's coming next for "${topic}". Base it on patterns, foreshadowing, or industry trends. Express excitement or concern about the direction.`
    },
    {
        type: "Technical Appreciation",
        prompt: (topic) => `Geek out over the production quality of "${topic}". Mention animation, soundtrack, voice acting, or art direction. Point to specific scenes or tracks that stood out.`
    },
    {
        type: "Relationship Dynamics",
        prompt: (topic) => `Discuss character relationships or ships in "${topic}". Defend a pairing or explain why one doesn't work. Use evidence from their interactions.`
    },
    {
        type: "Villain Analysis",
        prompt: (topic) => `Analyze the antagonist in "${topic}". Discuss their motivations, complexity, or lack thereof. Argue whether they're well-written or one-dimensional.`
    },
    {
        type: "Character Growth",
        prompt: (topic) => `Track a character's development in "${topic}". Highlight key moments that changed them. Discuss whether their arc felt earned or rushed.`
    }
];

/**
 * Generates a highly randomized, human-like post for a bot.
 * @param {string} botCorePrompt - The core directive of the bot's personality.
 * @returns {Promise<string>} - The generated post content.
 */
export const generateBotPost = async (botCorePrompt) => {
    let topic;
    try {
        const topics = await getFreshAnimeNews();
        if (topics.length === 0) {
            throw new Error("No fresh anime topics could be fetched.");
        }
        
        topic = topics[Math.floor(Math.random() * topics.length)];
        const scenario = PostScenarios[Math.floor(Math.random() * PostScenarios.length)];

        // Randomly select style elements
        const opening = OpeningStyles[Math.floor(Math.random() * OpeningStyles.length)];
        const transition = TransitionPhrases[Math.floor(Math.random() * TransitionPhrases.length)];
        const emphasis = EmphasisStyles[Math.floor(Math.random() * EmphasisStyles.length)];
        const questionEnd = QuestionEndings[Math.floor(Math.random() * QuestionEndings.length)];
        const emojis = EmojiPatterns[Math.floor(Math.random() * EmojiPatterns.length)];

        console.log(`LLM Service: Generating a "${scenario.type}" post for topic "${topic.title}"`);

        // Build constraints to force variation
        const styleConstraints = `
CRITICAL VARIATION RULES:
- ${opening ? `Start with: "${opening}"` : "Jump straight into your point with NO opening phrase"}
- Use "${transition}" naturally in the middle
- Use "${emphasis}" once for emphasis
- ${questionEnd ? `End with: "${questionEnd}"` : "End with a statement, NO question"}
- ${emojis.length > 0 ? `Include these emojis ONLY: ${emojis.join(" ")}` : "Use ZERO emojis"}
- NEVER use these banned phrases: "Okay", "OMG", "Man,", "Honestly", "got me thinking", "hits hard", "let's talk", "deep dive", "chef's kiss", "wild", "nuance", "resonates"
- NEVER mention "AniList", "X (Twitter)", "trending", or "buzzing" unless the topic title explicitly mentions them
- Write in YOUR natural speaking voice, not generic social media voice
- Vary sentence structure: mix short punchy sentences with longer complex ones
- Use slang/casual language that fits YOUR personality, not everyone's
- Word count: ${40 + Math.floor(Math.random() * 90)} words (randomized length)
`;

        const fullPrompt = `
You are this specific person posting on social media:
${botCorePrompt}

Post about: ${scenario.prompt(topic.title)}

${styleConstraints}

Make it sound like YOU specifically, not a generic anime fan. Reference your own interests, speech patterns, and perspective. Be opinionated. Use unexpected comparisons or references. Make typos occasionally (like casual real people do). 

Write the complete post now:
`;

        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        let postText = response.text().trim();

        // Add hashtags (2-4, varied)
        const hashtagCount = Math.floor(Math.random() * 3) + 2;
        const hashtagOptions = [
            "#anime", "#manga", "#animecommunity", "#otaku", "#weeb",
            "#animetwt", "#animereview", "#animethoughts", "#mangareader",
            "#seasonalanime", "#animelife", "#animefan", "#animediscussion"
        ];
        
        // Shuffle and pick random hashtags
        const shuffled = hashtagOptions.sort(() => 0.5 - Math.random());
        const selectedTags = shuffled.slice(0, hashtagCount).join(" ");
        
        postText += `\n\n${selectedTags}`;

        return postText;

    } catch (error) {
        console.error("Error generating bot post:", error.message);
        const fallbackOpeners = [
            "This didn't hit the way I expected.",
            "Watched this and felt kinda meh.",
            "Expected more from this tbh.",
            "This one missed for me.",
            "Not what I hoped for honestly."
        ];
        const fallbackTopic = topic ? topic.title : "this recent release";
        const randomOpener = fallbackOpeners[Math.floor(Math.random() * fallbackOpeners.length)];
        return `${randomOpener} ${fallbackTopic}. Anyone else? #anime #thoughts`;
    }
};

/**
 * Generates a varied, human-like comment on a user's post.
 * @param {string} botCorePrompt - The core directive of the bot.
 * @param {string} originalPostContent - The content of the post to comment on.
 * @returns {Promise<string>} - The generated comment.
 */
export const generateBotComment = async (botCorePrompt, originalPostContent) => {
    try {
        // Random comment style
        const commentStyles = [
            "Agree strongly and add your own example",
            "Politely disagree with a counterpoint",
            "Ask a follow-up question about their take",
            "Share a related personal experience",
            "Add a detail they didn't mention",
            "Challenge them playfully",
            "Express surprise at their perspective",
            "Relate it to something completely different",
            "Give a short but thoughtful analysis",
            "React emotionally but explain why"
        ];
        
        const style = commentStyles[Math.floor(Math.random() * commentStyles.length)];
        const emojis = EmojiPatterns[Math.floor(Math.random() * EmojiPatterns.length)];
        const emphasisWord = EmphasisStyles[Math.floor(Math.random() * EmphasisStyles.length)];

        const fullPrompt = `
You are this person commenting:
${botCorePrompt}

Original post: "${originalPostContent}"

Comment style: ${style}
${emojis.length > 0 ? `Use these emojis: ${emojis.join(" ")}` : "No emojis"}
Include the word "${emphasisWord}" naturally once

BANNED PHRASES: "Okay", "Honestly", "hits hard", "chef's kiss", "wild take", "hot take", "deep dive", "nuance", "resonates", "love this", "this!", "so much this"

Length: ${20 + Math.floor(Math.random() * 50)} words

Sound like YOUR specific personality, not generic. Be conversational. Make it feel like you actually read and thought about their post. No corporate positivity - be real.

Write the comment now:
`;

        const result = await model.generateContent(fullPrompt);
               const response = await result.response;
        return response.text().trim();
    } catch (error) {
        console.error("Error generating bot comment:", error);
        const fallbacks = [
            "Interesting perspective on this.",
            "Haven't thought about it that way before.",
            "Fair point actually.",
            "Can see where you're coming from.",
            "Different take than mine but valid.",
            "This made me reconsider."
        ];
        return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }
};