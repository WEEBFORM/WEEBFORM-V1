import { db } from "../../config/connectDB.js";
import { authenticateUser } from "../../middlewares/verify.mjs";
import RSSParser from "rss-parser";
import axios from 'axios';

// --- Import the CloudFront URL processor ---
import { processImageUrl } from "../../middlewares/cloudfrontConfig.js";

const parser = new RSSParser();

// --- Centralized helper with the "smart URL" logic included ---
const processNewsPosts = (posts) => {
    if (!posts || posts.length === 0) {
        return [];
    }
    return posts.map(post => {
        // Process post media (if it exists)
        if (post.media) {
            const mediaKeysOrUrls = post.media.split(',');
            // Map over each item and apply the smart URL logic
            post.media = mediaKeysOrUrls.map(keyOrUrl => {
                const trimmedItem = keyOrUrl.trim();
                // If it's already a full URL, use it directly.
                if (trimmedItem.startsWith('http')) {
                    return trimmedItem;
                }
                // Otherwise, build the CDN URL from the key.
                return processImageUrl(trimmedItem);
            });
        }
        
        // Process the author's profile picture
        if (post.profilePic) {
            // If it's already a full URL (from a bot), use it directly.
            if (post.profilePic.startsWith('http')) {
                // No action needed, the URL is already correct.
            } else {
                // Otherwise, build the CDN URL from the key.
                post.profilePic = processImageUrl(post.profilePic);
            }
        }
        
        return post;
    });
};

// ALL NEWS (Refactored with async/await and CloudFront)
export const allnews = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const query = `
                SELECT
                    p.*, u.id AS userId, u.username, u.full_name, u.profilePic,
                    (SELECT COUNT(*) FROM likes WHERE postId = p.id) AS likesCount
                FROM posts AS p
                LEFT JOIN users AS u ON p.userId = u.id
                WHERE p.category = 'News' OR 
                    (
                        p.description LIKE '%to be released%' OR p.description LIKE '%will be released%' OR
                        p.description LIKE '%Released%' OR p.description LIKE '%release%' OR
                        p.description LIKE '%releases%' OR p.description LIKE '%releasing%' OR
                        p.description LIKE '%Announced%' OR p.description LIKE '%announced%' OR
                        p.description LIKE '%Announcement%' OR p.description LIKE '%announcement%' OR
                        p.description LIKE '%Highlights%' OR p.description LIKE '%Info%' OR
                        p.description LIKE '%Season%' OR p.description LIKE '%premieres%'
                    )
                GROUP BY p.id, u.id
                ORDER BY p.createdAt DESC;
            `;

            const [data] = await db.promise().query(query);

            if (data.length === 0) {
                return res.status(404).json({ message: "No news found." });
            }

            const processedPosts = processNewsPosts(data);
            return res.status(200).json(processedPosts);

        } catch (err) {
            console.error("Error fetching all news:", err);
            return res.status(500).json({ error: "Internal Server Error" });
        }
    });
};

// VIEW NEWS BASED ON CATEGORY (Refactored with async/await and CloudFront)
export const categorizedNews = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const category = req.params.category;
            const q = `
                SELECT
                    p.*, u.id AS userId, u.username, u.full_name, u.profilePic,
                    (SELECT COUNT(*) FROM likes WHERE postId = p.id) AS likesCount
                FROM posts AS p
                LEFT JOIN users AS u ON p.userId = u.id
                WHERE p.category = ? AND
                    (
                        p.description LIKE '%to be released%' OR p.description LIKE '%will be released%' OR
                        p.description LIKE '%Release%' OR p.description LIKE '%release%' OR
                        p.description LIKE '%releases%' OR p.description LIKE '%releasing%' OR
                        p.description LIKE '%Announced%' OR p.description LIKE '%announced%' OR
                        p.description LIKE '%Announcement%' OR p.description LIKE '%announcement%' OR
                        p.description LIKE '%Highlights%' OR p.description LIKE '%Season%' OR
                        p.description LIKE '%premiere%'
                    )
                GROUP BY p.id, u.id
                ORDER BY p.createdAt DESC;
            `;

            const [data] = await db.promise().query(q, [category]);

            if (data.length === 0) {
                return res.status(404).json({ message: "No information found in this category." });
            }

            const processedPosts = processNewsPosts(data);
            return res.status(200).json(processedPosts);

        } catch (err) {
            console.error("Error fetching categorized news:", err);
            return res.status(500).json({ error: "Internal Server Error" });
        }
    });
};


// --- EXTERNAL API FETCHERS (Unchanged) ---

export const animeNewsNetwork = async (req, res) => {
    try {
        const feed = await parser.parseURL("https://www.animenewsnetwork.com/all/rss.xml");
        const articles = feed.items.map((item) => ({
            title: item.title,
            link: item.link,
            pubDate: item.pubDate,
            description: item.contentSnippet,
        }));
        res.json(articles);
    } catch (error) {
        console.error("Failed to fetch RSS feed:", error);
        res.status(500).json({ message: "Failed to fetch Anime News Network feed." });
    }
};

export const fetchConsolidatedAnimeData = async (req, res) => {
    try {
        const [jikanResponse, kitsuResponse, graphqlResponse] = await Promise.all([
            axios.get("https://api.jikan.moe/v4/seasons/now"),
            axios.get("https://kitsu.io/api/edge/anime?page[limit]=10"),
            axios.post("https://graphql.anilist.co", {
                query: `{
                    Page(page: 1, perPage: 10) {
                        media(type: ANIME, sort: POPULARITY_DESC) {
                            id
                            title { romaji }
                            coverImage { large }
                            description
                        }
                    }
                }`
            })
        ]);

        const jikanData = jikanResponse.data.data;
        const kitsuData = kitsuResponse.data.data;
        const graphqlData = graphqlResponse.data.data.Page.media;

        const transformedJikanData = jikanData.map(anime => ({
            title: anime.title,
            link: anime.url,
            pubDate: null,
            description: anime.synopsis || "No synopsis available",
            image_url: anime.images?.jpg?.image_url || null,
            source: "Jikan"
        }));

        const transformedKitsuData = kitsuData.map(anime => ({
            title: anime.attributes.titles?.en || anime.attributes.canonicalTitle,
            link: `https://kitsu.io/anime/${anime.id}`,
            pubDate: null,
            description: anime.attributes.synopsis,
            image_url: anime.attributes.posterImage?.original || null,
            source: "Kitsu"
        })); 

        const transformedGraphqlData = graphqlData.map(anime => ({
            title: anime.title.romaji,
            link: `https://anilist.co/anime/${anime.id}`,
            pubDate: null,
            description: anime.description,
            image_url: anime.coverImage?.large || null,
            source: "AniList"
        }));

        const consolidatedData = [
            ...transformedJikanData,
            ...transformedKitsuData,
            ...transformedGraphqlData
        ];
        const news = shuffleData(consolidatedData);

        res.json(news);

    } catch (error) {
        console.error("Failed to fetch consolidated anime data:", error);
        res.status(500).json({ message: "Error fetching anime data", error });
    }
};

const shuffleData = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};