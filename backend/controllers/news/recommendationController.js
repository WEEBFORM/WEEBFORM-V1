import { db } from "../../config/connectDB.js";
import { authenticateUser } from "../../middlewares/verify.mjs";
import { fetchAndTransformExternalAnimeData } from "../../utils/animeDataFetcher.js";
import NodeCache from 'node-cache';

//CACHE USER RECOMMENDATIONS
const recommendationCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

const RECOMMENDATION_COUNT = 10;

export const getAnimeRecommendations = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;
        const cacheKey = `recommendations:${userId}`;

        try {
            const cachedRecommendations = recommendationCache.get(cacheKey);
            if (cachedRecommendations) {
                console.log(`Serving recommendations for user ${userId} from cache.`);
                return res.status(200).json(cachedRecommendations);
            }

            console.log(`Generating recommendations for user ${userId}.`);
            const userPreferencesQuery = `
                SELECT DISTINCT LOWER(p.category) AS category, LOWER(p.tags) AS tags
                FROM likes l
                JOIN posts p ON l.postId = p.id
                WHERE l.userId = ? AND (p.category IS NOT NULL OR p.tags IS NOT NULL);
            `;
            const [preferenceResults] = await db.promise().query(userPreferencesQuery, [userId]);

            const userPreferredCategories = new Set();
            const userPreferredTags = new Set();

            preferenceResults.forEach(row => {
                if (row.category && row.category.trim()) {
                    userPreferredCategories.add(row.category.trim());
                }
                if (row.tags) {
                    row.tags.split(',')
                        .map(tag => tag.trim().toLowerCase())
                        .filter(tag => tag)
                        .forEach(tag => userPreferredTags.add(tag));
                } 
            });

            // COMBINE PREFERENCES INTO ONE SET AND FETCH POOL
            const combinedPreferences = new Set([...userPreferredCategories, ...userPreferredTags]);

            let weebformUserAnime = await fetchAndTransformExternalAnimeData();

            if (!weebformUserAnime || weebformUserAnime.length === 0) {
                 console.error(`Failed to fetch anime pool for user ${userId}.`);
                 return res.status(500).json({ message: "Could not retrieve anime data for recommendations." });
            }

            let finalRecommendations = [];

            //POSSIBLE FALLBACKS
            if (combinedPreferences.size === 0) {
                console.log(`User ${userId} has no recorded preferences (liked categories/tags). Returning general popular/recent anime.`);
                 finalRecommendations = weebformUserAnime
                    .sort((a, b) => {
                        // SORT BY SCORE AND MEMBERS(desc)
                        if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
                        return (b.members || 0) - (a.members || 0);
                    })
                    .slice(0, RECOMMENDATION_COUNT);

            } else {
                console.log(`User ${userId} preferences:`, combinedPreferences);
                const scoredAnime = weebformUserAnime.map(anime => {
                    let score = 0;
                    const animeKeywords = new Set();
                    (anime.genres || []).forEach(g => animeKeywords.add(g));
                    (anime.themes || []).forEach(t => animeKeywords.add(t));
                    (anime.demographics || []).forEach(d => animeKeywords.add(d));
                    (anime.studios || []).forEach(s => animeKeywords.add(s));
                    (anime.title?.toLowerCase().split(/\s+/) || []).filter(w => w.length > 2).forEach(w => animeKeywords.add(w));
                    //CALCULATE SCORE
                    combinedPreferences.forEach(pref => {
                        if (animeKeywords.has(pref)) {
                            score += 2;
                        }
                    });

                    // SCORE BONUSES PER JIKAN METRICS
                    if (anime.score && anime.score > 7.8) score += 1.5;
                    else if (anime.score && anime.score > 7.0) score += 0.75;
                    if (anime.members && anime.members > 150000) score += 0.5;
                    if (anime.favorites && anime.favorites > 10000) score += 0.5;

                    return { ...anime, recommendationScore: score };
                });
                //SORT BY SCORE(for tie-breakers)
                const rankedAnime = scoredAnime
                    .filter(anime => anime.recommendationScore > 0)
                    .sort((a, b) => {
                        //SCORE
                        if (b.recommendationScore !== a.recommendationScore) {
                            return b.recommendationScore - a.recommendationScore;
                        }
                        // JIKAN SCORE
                        if ((b.score || 0) !== (a.score || 0)) {
                           return (b.score || 0) - (a.score || 0);
                        }
                        // MEMBER COUNT
                        return (b.members || 0) - (a.members || 0);
                    });

                finalRecommendations = rankedAnime.slice(0, RECOMMENDATION_COUNT);

                 // IN THE EVENT USER HAS NO MATCHES
                 if (finalRecommendations.length === 0) {
                      console.log(`No matching anime found for user ${userId} preferences. Falling back to general popular/recent.`);
                      // SORT ORIGINAL LIST
                      finalRecommendations = weebformUserAnime
                            .sort((a, b) => {
                                if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
                                return (b.members || 0) - (a.members || 0);
                            })
                            .slice(0, RECOMMENDATION_COUNT);
                 }
            }

            console.log(`Generated ${finalRecommendations.length} recommendations for user ${userId}.`);
            recommendationCache.set(cacheKey, finalRecommendations);

            res.status(200).json(finalRecommendations);

        } catch (error) {
            console.error(`Error in getAnimeRecommendations for user ${userId}:`, error);
            res.status(500).json({ message: "Failed to generate anime recommendations.", error: error.message || "Unknown error" });
        }
    });
}; 