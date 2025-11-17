import axios from 'axios';
import RSSParser from 'rss-parser';

const parser = new RSSParser();

// INDIVIDUAL SOURCE FETCHERS

const fetchFromKitsu = async () => {
    try {
        const response = await axios.get("https://kitsu.io/api/edge/trending/anime", { timeout: 8000 });
        return response.data.data.map(anime => {
            const title = anime.attributes.canonicalTitle || "Anime";
            return {
                title: title,
                link: `https://kitsu.io/anime/${anime.id}`,
                source: "Kitsu.io",
                content: (anime.attributes.synopsis || "No synopsis available.").substring(0, 280) + "...",
                imageUrl: anime.attributes.posterImage?.large || null,
            };
        });
    } catch (error) {
        console.error("Failed to fetch from Kitsu.io:", error.message);
        return [];
    }
};

const fetchFromAnimeNewsNetwork = async () => {
    try {
        const feed = await parser.parseURL("https://www.animenewsnetwork.com/all/rss.xml");
        return feed.items.map(item => ({
            title: item.title,
            link: item.link,
            source: "Anime News Network",
            content: item.contentSnippet || "",
            imageUrl: item.enclosure?.url, // GRAB IMAGE FROM RSS ENCLOSURE
        }));
    } catch (error) {
        console.error("Failed to fetch from Anime News Network:", error.message);
        return [];
    }
};

const fetchFromJikan = async () => {
    try {
        const response = await axios.get("https://api.jikan.moe/v4/seasons/now", { timeout: 8000 });
        return response.data.data.map(anime => {
            // Use large image URL for better quality
            const largeImageUrl = anime.images?.jpg?.large_image_url || 
                                 anime.images?.jpg?.image_url || 
                                 null;
            
            return {
                title: `${anime.title}`,
                link: anime.url,
                source: "Jikan API (MyAnimeList)",
                content: anime.synopsis || "No synopsis available.",
                imageUrl: largeImageUrl,
            };
        });
    } catch (error) {
        console.error("Failed to fetch from Jikan:", error.message);
        return [];
    }
};

const fetchFromAnilist = async () => {
    try {
        const response = await axios.post("https://graphql.anilist.co", {
            query: `{
                Page(page: 1, perPage: 20) {
                    media(type: ANIME, sort: TRENDING_DESC, isAdult: false) {
                        id
                        title { romaji english native }
                        description(asHtml: false)
                        coverImage { extraLarge large medium }
                        bannerImage
                        episodes
                        status
                        season
                    }
                }
            }`
        }, { timeout: 8000 });

        return response.data.data.Page.media.map(anime => {
            // Prioritize banner image for social media, then extra large cover
            const bestImage = anime.bannerImage || 
                            anime.coverImage?.extraLarge || 
                            anime.coverImage?.large || 
                            anime.coverImage?.medium || 
                            null;
            
            const title = anime.title.romaji || anime.title.english || anime.title.native || "Anime";
            
            return {
                title: title,
                link: `https://anilist.co/anime/${anime.id}`,
                source: "AniList",
                content: (anime.description || "").substring(0, 280) + "...",
                imageUrl: bestImage,
            };
        });
    } catch (error) {
        console.error("Failed to fetch from AniList:", error.message);
        return [];
    }
};

// NEW: Enhanced manga source with better images
const fetchFromMangaDex = async () => {
    try {
        const response = await axios.get("https://api.mangadex.org/manga", {
            params: {
                limit: 20,
                order: '{"rating":"desc"}',
                "includes[]": ["cover_art"],
                status: ["ongoing", "completed"]
            },
            timeout: 8000
        });

        return response.data.data.map(manga => {
            // Extract cover image
            const coverArt = manga.relationships.find(rel => rel.type === 'cover_art');
            const coverImageUrl = coverArt 
                ? `https://uploads.mangadex.org/covers/${manga.id}/${coverArt.attributes.fileName}.256.jpg`
                : null;

            const title = manga.attributes.title.en || Object.values(manga.attributes.title)[0] || "Manga";

            return {
                title: title,
                link: `https://mangadex.org/title/${manga.id}`,
                source: "MangaDex",
                content: (manga.attributes.description?.en || "No description available.").substring(0, 280) + "...",
                imageUrl: coverImageUrl,
            };
        });
    } catch (error) {
        console.error("Failed to fetch from MangaDex:", error.message);
        return [];
    }
};

// --- MAIN AGGREGATOR FUNCTION ---

/**
 * Fetches, consolidates, and deduplicates news from multiple anime/manga sources.
 * Prioritizes high-quality images from premium CDNs.
 * @returns {Promise<Array<object>>} A shuffled array of unique news articles with quality images.
 */
export const getFreshAnimeNews = async () => {
    console.log("Aggregator: Fetching fresh anime news from all sources...");

    const results = await Promise.allSettled([
        fetchFromAnimeNewsNetwork(),
        fetchFromJikan(),
        fetchFromAnilist(),
        fetchFromMangaDex(),
        fetchFromKitsu()
    ]);

    const successfulResults = results
        .filter(result => result.status === 'fulfilled' && result.value.length > 0)
        .flatMap(result => result.value);

    if (successfulResults.length === 0) {
        console.log("Aggregator: Could not fetch news from any source.");
        return [];
    }

    // Deduplicate articles based on title to avoid spamming similar news
    const uniqueArticles = new Map();
    successfulResults.forEach(article => {
        const cleanedTitle = article.title.toLowerCase().trim();
        
        // Only add if not already present, or if this version has a better image
        if (!uniqueArticles.has(cleanedTitle)) {
            uniqueArticles.set(cleanedTitle, article);
        } else {
            const existing = uniqueArticles.get(cleanedTitle);
            // Upgrade to version with image if current one doesn't have it
            if (!existing.imageUrl && article.imageUrl) {
                uniqueArticles.set(cleanedTitle, article);
            }
        }
    });

    const articlesArray = Array.from(uniqueArticles.values());

    // Shuffle the final array to ensure variety
    for (let i = articlesArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [articlesArray[i], articlesArray[j]] = [articlesArray[j], articlesArray[i]];
    }

    // Log image quality statistics
    const articlesWithImages = articlesArray.filter(a => a.imageUrl).length;
    console.log(`Aggregator: Successfully consolidated ${articlesArray.length} unique news articles. ${articlesWithImages} have high-quality images.`);
    
    return articlesArray;
};