import axios from 'axios';

//RANDOMIZATION HELPERS
const getRandomInt = (min, max) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

const getRandomYear = () => {
    const currentYear = new Date().getFullYear();
    return getRandomInt(currentYear - 25, currentYear); //25 YEARS AGO TILL PRESENT
};

const seasons = ['spring', 'summer', 'fall', 'winter'];
const getRandomSeason = () => seasons[getRandomInt(0, seasons.length - 1)];

const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const getRandomDay = () => days[getRandomInt(0, days.length - 1)];

// ANIME TYPES
const animeTypes = ['tv', 'movie', 'ova', 'special', 'ona', 'music'];
const getRandomAnimeType = () => animeTypes[getRandomInt(0, animeTypes.length - 1)];

// SEARCH KEYWORDS
const animeSearchKeywords = [
    'action', 'adventure', 'isekai', 'magic', 'fantasy', 'shonen', 'mecha',
    'romance', 'comedy', 'slice of life', 'school', 'vampire', 'ninja',
    'sports', 'music', 'mystery', 'supernatural', 'dragon', 'demon', 'game',
    'space', 'historical', 'cyberpunk', 'zombie', 'survival', 'cooking', 'detective',
    'robot', 'samurai', 'pirate', 'idol', 'mafia', 'detective', 'psychological'
];
const getRandomSearchQuery = () => {
    const query = animeSearchKeywords[getRandomInt(0, animeSearchKeywords.length - 1)];
    return encodeURIComponent(query); 
};

//I'LL ADD THIS AS A MIDDLEWARE LATER AS IT'S REOCCURING
const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};


// --- Endpoint Configurations ---
// Define different ways to fetch data, using the random helpers
// Using sfw=true to filter potentially explicit content

const endpointConfigurations = [
    // CURRENT AND UPCOMING
    { name: 'seasons_now', generateUrl: () => `https://api.jikan.moe/v4/seasons/now?limit=25&sfw=true` },
    { name: 'seasons_upcoming', generateUrl: () => `https://api.jikan.moe/v4/seasons/upcoming?limit=25&sfw=true` },
    // Top Anime (Different types)
    { name: 'top_general', generateUrl: () => `https://api.jikan.moe/v4/top/anime?limit=25&sfw=true` },
    { name: 'top_random_type', generateUrl: () => `https://api.jikan.moe/v4/top/anime?type=${getRandomAnimeType()}&limit=25&sfw=true` },
    // Random Season Archive
    { name: 'random_season', generateUrl: () => `https://api.jikan.moe/v4/seasons/${getRandomYear()}/${getRandomSeason()}?limit=25&sfw=true` },
    // Random Schedule (Can be less useful for general pool, but adds variety)
    // { name: 'random_schedule', generateUrl: () => `https://api.jikan.moe/v4/schedules/${getRandomDay()}?limit=15&sfw=true` }, // Reduced limit maybe
    // Random Search Query
    { name: 'random_search', generateUrl: () => `https://api.jikan.moe/v4/anime?q=${getRandomSearchQuery()}&limit=25&sfw=true&order_by=members&sort=desc` }, // Order by popularity
];


// --- Main Fetching Function ---

export const fetchAndTransformExternalAnimeData = async () => {
    console.log("Fetching diverse anime data from Jikan...");

    // Select a few different configurations to fetch from (e.g., 3-5)
    const shuffledConfigs = shuffleArray([...endpointConfigurations]);
    const configsToFetch = [];
    const selectedNames = new Set();
    const numberOfEndpointsToHit = 4; // Adjust this number

    for (const config of shuffledConfigs) {
        if (configsToFetch.length >= numberOfEndpointsToHit) break;
        if (!selectedNames.has(config.name)) {
            configsToFetch.push(config);
            selectedNames.add(config.name);
        }
    }
    // Ensure basic relevance if needed
    if (configsToFetch.length < numberOfEndpointsToHit && !selectedNames.has('seasons_now')) {
        const nowConfig = endpointConfigurations.find(c => c.name === 'seasons_now');
        if(nowConfig) { configsToFetch.push(nowConfig); selectedNames.add('seasons_now'); }
    }
    if (configsToFetch.length < numberOfEndpointsToHit && !selectedNames.has('top_general')) {
         const topConfig = endpointConfigurations.find(c => c.name === 'top_general');
         if(topConfig) { configsToFetch.push(topConfig); selectedNames.add('top_general'); }
    }

    const urlsToFetch = configsToFetch.map(config => config.generateUrl());
    console.log("Fetching from Jikan URLs:", urlsToFetch);

    try {
        // Use Promise.allSettled to handle potential errors gracefully
        const results = await Promise.allSettled(urlsToFetch.map(url => axios.get(url)));

        const allJikanAnime = new Map(); // Use Map for efficient deduplication by mal_id

        results.forEach((result, index) => {
            const sourceUrl = urlsToFetch[index];
            if (result.status === 'fulfilled' && result.value?.data?.data) {
                const animeList = result.value.data.data;
                if (Array.isArray(animeList)) {
                     console.log(`Successfully fetched ${animeList.length} items from ${sourceUrl}`);
                    animeList.forEach(anime => {
                        if (anime && anime.mal_id && !allJikanAnime.has(anime.mal_id)) {
                            allJikanAnime.set(anime.mal_id, anime);
                        }
                    });
                } else {
                     console.log(`No data array found in response from ${sourceUrl}`);
                }
            } else if (result.status === 'rejected') {
                console.warn(`Failed to fetch from ${sourceUrl}: ${result.reason?.message || result.reason}`);
                if (result.reason?.response?.status) {
                    console.warn(` -> Status: ${result.reason.response.status}, Data: ${JSON.stringify(result.reason.response.data)}`);
                }
            } else {
                 console.warn(`Unexpected result status or missing data from ${sourceUrl}`);
            }
        });

        const uniqueJikanAnimeList = Array.from(allJikanAnime.values());

        if (uniqueJikanAnimeList.length === 0) {
            console.warn("No anime data retrieved successfully from any Jikan endpoint.");
            return [];
        }

        console.log(`Total unique anime fetched: ${uniqueJikanAnimeList.length}`);

        // --- Transform Jikan Data ---
        const transformedJikanData = uniqueJikanAnimeList.map(anime => ({
            id: `jikan-${anime.mal_id}`,
            title: anime.title_english || anime.title || anime.title_japanese, // Best available title
            link: anime.url,
            description: anime.synopsis || "No synopsis available.",
            image_url: anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || null,
            // Keywords for matching
            genres: (anime.genres || []).map(g => g.name.toLowerCase()),
            themes: (anime.themes || []).map(t => t.name.toLowerCase()),
            demographics: (anime.demographics || []).map(d => d.name.toLowerCase()),
            // Other potentially useful fields
            status: anime.status,
            type: anime.type,
            source_material: anime.source, // e.g., Manga, Original, Light novel
            episodes: anime.episodes,
            duration: anime.duration,
            rating: anime.rating, // e.g., "PG-13 - Teens 13 or older"
            studios: (anime.studios || []).map(s => s.name.toLowerCase()),
            // Score and Popularity metrics
            score: anime.score, // Jikan score (0-10 scale)
            scored_by: anime.scored_by,
            rank: anime.rank,
            popularity: anime.popularity, // Jikan popularity rank
            members: anime.members, // Number of members on MAL
            favorites: anime.favorites, // Number of favorites on MAL
            // API Source marker
            source_api: "Jikan"
        }));

        // Shuffle the final unique, transformed list
        return shuffleArray(transformedJikanData);

    } catch (error) {
        console.error("General error during Jikan data fetching pipeline:", error);
        return []; // Return empty list on major failure
    }
};