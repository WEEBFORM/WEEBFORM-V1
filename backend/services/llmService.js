import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// ULTRA-RANDOMIZED POST SCENARIOS WITH STRUCTURAL VARIATION
const generateDynamicScenario = (topic) => {
    const openers = [
        `ngl ${topic}`, `so like ${topic}`, `ok but ${topic}`, `hear me out on ${topic}`, 
        `unpopular take: ${topic}`, `nobody talks about how ${topic}`, `why is ${topic}`,
        `${topic} hit different`, `the more i think about ${topic}`, `im convinced ${topic}`,
        `lowkey ${topic}`, `cant stop thinking about ${topic}`, `hot take: ${topic}`,
        `${topic} has me feeling`, `imagine if ${topic}`, `${topic} but make it`,
        `${topic} was actually`, `so ${topic} right`, `${topic} said what it said`,
        `the fact that ${topic}`, `caught ${topic} being`, `${topic} walked so`,
        `${topic} really said`, `${topic} is the type to`, `${topic} understood the assignment`,
        `${topic} ate and left no crumbs`, `${topic} snatched my wig`, `tell me why ${topic}`
    ];

    const contentStructures = [
        // Structure 1: Opinion with reason
        () => {
            const reasons = ["because", "since", "like", "cuz", "fr fr"];
            const reason = reasons[Math.floor(Math.random() * reasons.length)];
            return `${reason} the animation just hits harder`;
        },
        // Structure 2: Comparison
        () => {
            const comparisons = ["better than", "way better than", "slaps harder than", "absolutely destroys"];
            const comp = comparisons[Math.floor(Math.random() * comparisons.length)];
            return `${comp} most of what came before it`;
        },
        // Structure 3: Question variant
        () => {
            const questions = ["why does it hit so hard tho", "why is nobody talking about this", "am i the only one who", "tell me im not the only one"];
            return questions[Math.floor(Math.random() * questions.length)];
        },
        // Structure 4: Emotional reaction
        () => {
            const reactions = ["i wasnt ready for this", "not me crying rn", "this caught me off guard", "i was not prepared"];
            return reactions[Math.floor(Math.random() * reactions.length)];
        },
        // Structure 5: Character focus
        () => {
            const characterLines = ["the character development was insane", "the cast really carried it", "every character ate", "the protagonist understood the assignment"];
            return characterLines[Math.floor(Math.random() * characterLines.length)];
        },
        // Structure 6: Vibe check
        () => {
            const vibes = ["the vibes were immaculate", "the aesthetic hit right", "the energy was different", "the whole thing just felt right"];
            return vibes[Math.floor(Math.random() * vibes.length)];
        },
        // Structure 7: Contrarian take
        () => {
            const contrarian = ["people sleep on this", "people really underestimate it", "this deserves more credit", "this is underrated af"];
            return contrarian[Math.floor(Math.random() * contrarian.length)];
        },
        // Structure 8: Specific detail focus
        () => {
            const details = ["that one scene had me", "one moment literally", "this specific part was", "that moment changed everything"];
            return details[Math.floor(Math.random() * details.length)];
        },
        // Structure 9: Prediction/speculation
        () => {
            const predictions = ["calling it now this gonna be huge", "bet this becomes classic", "this is the next big thing", "im telling you this will blow up"];
            return predictions[Math.floor(Math.random() * predictions.length)];
        },
        // Structure 10: Controversial angle
        () => {
            const controversial = ["nah this part was actually weird", "not everything hit tho", "real talk some parts fumbled", "lowkey the pacing was off"];
            return controversial[Math.floor(Math.random() * controversial.length)];
        }
    ];

    const endings = [
        "fr fr no cap", "change my mind if u can", "periodt", "thats the tea", "no notes",
        "and i stand by it", "facts only", "literally", "im not even sorry", "dont @ me",
        "its true and u know it", "cope", "salty fans incoming lol", "sorry not sorry",
        "im just saying", "but go off i guess", "take it up with the anime gods", "idc idc",
        "that part", "what can i say", "im right and thats okay", "stay mad about it"
    ];

    const opener = openers[Math.floor(Math.random() * openers.length)];
    const content = contentStructures[Math.floor(Math.random() * contentStructures.length)]();
    const ending = Math.random() > 0.4 ? ` ${endings[Math.floor(Math.random() * endings.length)]}` : "";

    return `${opener}. ${content}${ending}`;
};

const PostScenarios = [
    {
        type: "Dynamic Random",
        prompt: (topic) => generateDynamicScenario(topic)
    },
    {
        type: "Dynamic Random v2",
        prompt: (topic) => generateDynamicScenario(topic)
    },
    {
        type: "Dynamic Random v3",
        prompt: (topic) => generateDynamicScenario(topic)
    }
];

// GENERATES IMAGE USING GEMINI WITH VISION API
const generateImageForTopic = async (topic, postContent) => {
    try {
        console.log(`LLM Service: Generating high-quality image for "${topic}"`);

        // Extract key anime details from topic and post for better image generation
        const imagePrompt = `You are a professional anime/manga illustration generator. Create a stunning, high-quality anime artwork based on this:

Title/Topic: "${topic}"
Related context: "${postContent}"

REQUIREMENTS:
- Generate an EXTREMELY HIGH QUALITY, DETAILED anime/manga illustration
- Must be visually striking and suitable for social media posts
- Rich colors, excellent composition, professional quality
- Specific to the anime/manga title or concept mentioned
- Include relevant characters, scenes, or visual elements from the title if identifiable
- Style: Professional anime poster quality, not generic
- Resolution: High detail, vibrant and eye-catching
- If it's a manga/anime series, capture the essence and aesthetic of that series

Create this image now:`;

        const result = await model.generateContent({
            contents: [{
                parts: [{
                    text: imagePrompt
                }]
            }]
        });

        const response = await result.response;
        
        // Extract image data from response
        if (response.candidates && response.candidates.length > 0) {
            const candidate = response.candidates[0];
            if (candidate.content && candidate.content.parts) {
                for (const part of candidate.content.parts) {
                    if (part.inlineData && part.inlineData.data) {
                        const base64Image = part.inlineData.data;
                        const mimeType = part.inlineData.mimeType || "image/jpeg";
                        console.log(`LLM Service: Successfully generated high-quality image for "${topic}"`);
                        return `data:${mimeType};base64,${base64Image}`;
                    }
                }
            }
        }
        
        console.log(`LLM Service: Image generation failed for "${topic}" - no inline data returned`);
        return null;
    } catch (error) {
        console.error(`Error generating image for topic "${topic}":`, error.message);
        return null;
    }
};

// VALIDATES AND FILTERS IMAGE URLS FOR QUALITY
const isHighQualityImageUrl = (url) => {
    if (!url) return false;
    
    const lowQualitySources = ['cdn.myanimelist', 'img.myanimelist', 'thumb'];
    const isLowQuality = lowQualitySources.some(source => url.toLowerCase().includes(source));
    
    const highQualitySources = ['anilist', 'jikan', 'gravatar', 'cloudinary', 'cdn.discordapp'];
    const isHighQuality = highQualitySources.some(source => url.toLowerCase().includes(source));
    
    return !isLowQuality && (isHighQuality || url.includes('png') || url.includes('webp'));
};

// FETCH HIGH-QUALITY IMAGE FROM ALTERNATIVE SOURCES
const fetchHighQualityImage = async (topic) => {
    try {
        const axios = require('axios');
        
        // Try to fetch from high-quality anime image sources
        const queries = [
            `https://api.jikan.moe/v4/anime?query=${encodeURIComponent(topic)}&limit=1`,
        ];

        for (const query of queries) {
            try {
                const response = await axios.get(query, { timeout: 5000 });
                if (response.data?.data?.[0]?.images?.jpg?.large_image_url) {
                    const imageUrl = response.data.data[0].images.jpg.large_image_url;
                    console.log(`LLM Service: Fetched high-quality image from API for "${topic}"`);
                    return imageUrl;
                }
            } catch (e) {
                // Continue to next source
            }
        }
        
        return null;
    } catch (error) {
        console.error(`Error fetching high-quality image:`, error.message);
        return null;
    }
};

// GENERATES A BOT POST BASED ON ITS CORE PROMPT AND A SPECIFIC TOPIC
export const generateBotPost = async (botCorePrompt, topic) => {
    try {
        if (!topic) {
            throw new Error("No topic was provided to generate a post.");
        }
        
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

        // HANDLE IMAGE: Prioritize quality sources, then generate if needed
        let finalMedia = null;

        // Check if provided image is high quality
        if (topic.imageUrl && isHighQualityImageUrl(topic.imageUrl)) {
            finalMedia = topic.imageUrl;
            console.log(`LLM Service: Using high-quality provided image for "${topic.title}"`);
        } else {
            // Try to fetch high-quality image from APIs
            console.log(`LLM Service: Searching for high-quality image for "${topic.title}"...`);
            const fetchedImage = await fetchHighQualityImage(topic.title);
            
            if (fetchedImage && isHighQualityImageUrl(fetchedImage)) {
                finalMedia = fetchedImage;
                console.log(`LLM Service: Found high-quality image from API for "${topic.title}"`);
            } else {
                // Fall back to AI generation if no quality image found
                console.log(`LLM Service: Generating AI image for "${topic.title}"...`);
                finalMedia = await generateImageForTopic(topic.title, postText);
            }
        }

        return { postText, media: finalMedia };

    } catch (error) {
        console.error("Error generating bot post:", error.message);
        const fallbackPosts = [
            `${topic?.title || "this anime"} is actually pretty good. way better than I thought it'd be #anime #animefan`,
            `nah ${topic?.title || "this one"} just didn't do it for me. pacing felt weird #anime #animethoughts`,
            `why is nobody talking about ${topic?.title || "this"}? it's way underrated #animecommunity #weeb`,
            `${topic?.title || "this anime"} had one scene that made it worth watching alone #animelife`,
            `so is anyone watching ${topic?.title || "this"} or just me? what do yall think? #animetwt`
        ];
        const fallbackText = fallbackPosts[Math.floor(Math.random() * fallbackPosts.length)];
        return { postText: fallbackText, media: topic.imageUrl || null };
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