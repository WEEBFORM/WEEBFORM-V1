import { db } from "../config/connectDB.js";
import { authenticateUser } from "../middlewares/verify.mjs";
import { s3, generateS3Url, s3KeyFromUrl } from "../middlewares/S3bucketConfig.js";
import RSSParser from "rss-parser";
const parser = new RSSParser();
import axios from 'axios'; 

// const handleAPIError = (error, res, message) => {
//     console.error(message, error);
//     return res.status(500).json({ message: message });
// };

// ALL NEWS
export const allnews = async (req, res) => {
    try {
        authenticateUser(req, res, async () => {
            const query = `
                SELECT
                    p.*,
                    u.id AS userId,
                    u.username,
                    u.full_name,
                    u.profilePic,
                    COUNT(l.id) AS likesCount
                FROM
                    posts AS p
                LEFT JOIN
                    users AS u ON p.userId = u.id
                LEFT JOIN
                    likes AS l ON l.postId = p.id
                WHERE
                    (
                        p.description LIKE '%to be released%' OR
                        p.description LIKE '%will be released%' OR
                        p.description LIKE '%Released%' OR
                        p.description LIKE '%release%' OR
                        p.description LIKE '%releases%' OR
                        p.description LIKE '%releasing%' OR
                        p.description LIKE '%Announced%' OR
                        p.description LIKE '%announced%' OR
                        p.description LIKE '%Announcement%' OR
                        p.description LIKE '%announcement%' OR
                        p.description LIKE '%Highlights%' OR
                        p.description LIKE '%Info%' OR
                        p.description LIKE '%Season%' OR
                        p.description LIKE '%premieres%'
                    )
                GROUP BY
                    p.id, u.id
                ORDER BY
                    p.createdAt DESC;
            `;
            db.query(query, async (err, data) => {
                if (err) {
                    console.error("Database query error:", err);
                    return res.status(500).json({ error: "Internal Server Error" });
                }

                if (data.length === 0) {
                    return res.status(404).json({ message: "No news found." });
                }

                try {
                    const processedPosts = await Promise.all(
                        data.map(async (post) => {
                            if (post.media) {
                                const mediaKeys = post.media.split(",").map(s3KeyFromUrl);
                                post.media = await Promise.all(mediaKeys.map(generateS3Url)).catch((error) => {
                                    console.error("Error generating media URLs:", error);
                                    return null;
                                });
                            }
                            if (post.profilePic) {
                                if (post.profilePic.startsWith('http')) {}
                                else {
                                    const profileKey = s3KeyFromUrl(post.profilePic);
                                    post.profilePic = await generateS3Url(profileKey).catch((error) => {
                                    console.error("Error generating profilePic URL:", error);
                                    return null;
                                });
                                }}

                            return post;
                        })
                    );

                    return res.status(200).json(processedPosts);
                } catch (processingError) {
                    console.error("Error processing posts:", processingError);
                    return res.status(500).json({ error: "Error processing posts." });
                }
            });
        });
    } catch (error) {
        console.error("Unhandled error:", error);
        return res.status(500).json({ error: "Unexpected server error." });
    }
};

// VIEW NEWS BASED ON CATEGORY
export const categorizedNews = (req, res) => {
    authenticateUser(req, res, () => {
        const category = req.params.category;
        const q = `SELECT
                p.*,
                u.id AS userId,
                u.username,
                u.full_name,
                u.profilePic,
                COUNT(l.id) AS likesCount
            FROM
                posts AS p
            LEFT JOIN
                users AS u ON p.userId = u.id
            LEFT JOIN
                likes AS l ON l.postId = p.id
            WHERE
                (
                    p.description LIKE '%to be released%' OR
                    p.description LIKE '%will be released%' OR
                    p.description LIKE '%Release%' OR
                    p.description LIKE '%release%' OR
                    p.description LIKE '%releases%' OR
                    p.description LIKE '%releasing%' OR
                    p.description LIKE '%Announced%' OR
                    p.description LIKE '%announced%' OR
                    p.description LIKE '%Announcement%' OR
                    p.description LIKE '%announcement%' OR
                    p.description LIKE '%Highlights%' OR
                    p.description LIKE '%Season%' OR
                    p.description LIKE '%premiere%'
                )
                AND p.category = ?
            GROUP BY
                p.id, u.id
            ORDER BY
                p.createdAt DESC;
            `

        db.query(q, category, async (err, data) => {
            if (err) return res.status(500).json(err);
            if (data.length === 0) {
                return res.status(404).json("No information found in this category.");
            }
            const processedPosts = await Promise.all(
                data.map(async (post) => {
                    if (post.media) {
                        const mediaKeys = post.media.split(",").map(s3KeyFromUrl);
                        try {
                            post.media = await Promise.all(mediaKeys.map(generateS3Url));
                        } catch (error) {
                            console.error("Error generating media URLs:", error);
                            post.media = null;
                        }
                    }
                    if (post.profilePic) {
                        const profileKey = s3KeyFromUrl(post.profilePic);
                        try {
                            post.profilePic = await generateS3Url(profileKey);
                        } catch (error) {
                            console.error("Error generating profilePic URL:", error);
                            post.profilePic = null;
                        }
                    }
                    return post;
                })
            );
            return res.status(200).json(processedPosts);
        });
    });
};

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
