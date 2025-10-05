import axios from 'axios';
import RSSParser from 'rss-parser';

const parser = new RSSParser();

// --- INDIVIDUAL SOURCE FETCHERS ---

const fetchFromAnimeNewsNetwork = async () => {
    try {
        const feed = await parser.parseURL("https://www.animenewsnetwork.com/all/rss.xml");
        return feed.items.map(item => ({
            title: item.title,
            link: item.link,
            source: "Anime News Network",
            content: item.contentSnippet || "",
        }));
    } catch (error) {
        console.error("Failed to fetch from Anime News Network:", error.message);
        return [];
    }
};

const fetchFromJikan = async () => {
    try {
        const response = await axios.get("https://api.jikan.moe/v4/seasons/now");
        return response.data.data.map(anime => ({
            title: `This Season's Highlight: ${anime.title}`,
            link: anime.url,
            source: "Jikan API (MyAnimeList)",
            content: anime.synopsis || "No synopsis available.",
        }));
    } catch (error) {
        console.error("Failed to fetch from Jikan:", error.message);
        return [];
    }
};

const fetchFromAnilist = async () => {
    try {
        const response = await axios.post("https://graphql.anilist.co", {
            query: `{
                Page(page: 1, perPage: 15) {
                    media(type: ANIME, sort: TRENDING_DESC) {
                        id
                        title { romaji }
                        description(asHtml: false)
                    }
                }
            }`
        });
        return response.data.data.Page.media.map(anime => ({
            title: `Trending on AniList: ${anime.title.romaji}`,
            link: `https://anilist.co/anime/${anime.id}`,
            source: "AniList",
            content: (anime.description || "").substring(0, 280) + "...",
        }));
    } catch (error) {
        console.error("Failed to fetch from AniList:", error.message);
        return [];
    }
};

// --- MAIN AGGREGATOR FUNCTION ---

/**
 * Fetches, consolidates, and deduplicates news from multiple anime sources.
 * @returns {Promise<Array<object>>} A shuffled array of unique news articles.
 */
export const getFreshAnimeNews = async () => {
    console.log("Aggregator: Fetching fresh anime news from all sources...");

    const results = await Promise.allSettled([
        fetchFromAnimeNewsNetwork(),
        fetchFromJikan(),
        fetchFromAnilist(),
        // Add more fetcher functions here in the future
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
        if (!uniqueArticles.has(cleanedTitle)) {
            uniqueArticles.set(cleanedTitle, article);
        }
    });

    const shuffledNews = Array.from(uniqueArticles.values());

    // Shuffle the final array to ensure variety
    for (let i = shuffledNews.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledNews[i], shuffledNews[j]] = [shuffledNews[j], shuffledNews[i]];
    }

    console.log(`Aggregator: Successfully consolidated ${shuffledNews.length} unique news articles.`);
    return shuffledNews;
};