export const communities = (req, res) => {
    authenticateUser(req, res, async () => { // Ensure authenticateUser handles async correctly
        const userId = req.user.id;

        try {
            // 1. Fetch necessary base data in parallel
            console.log(`[${userId}] Fetching base data...`);
            const [
                allCommunitiesData,
                followingData,
                joinedCommunitiesData,
            ] = await Promise.all([
                db.promise().query(`
                    SELECT
                        c.id, c.title, c.description, c.groupIcon, c.createdAt, c.creatorId,
                        (SELECT COUNT(*) FROM members WHERE comId = c.id) AS memberCount
                    FROM communities AS c
                `),
                db.promise().query(`SELECT followed FROM reach WHERE follower = ?`, [userId]),
                db.promise().query(`SELECT comId FROM members WHERE memberId = ?`, [userId])
            ]);

            const allCommunities = allCommunitiesData[0];
            const followingIds = followingData[0].map(f => f.followed);
            const joinedCommunityIds = new Set(joinedCommunitiesData[0].map(m => m.comId));
            // This Set will track IDs used in *any* category (joined, recommended, popular)
            const categorizedCommunityIds = new Set(joinedCommunityIds);

            console.log(`[${userId}] Total communities fetched from DB: ${allCommunities.length}`);
            console.log(`[${userId}] User is member of ${joinedCommunityIds.size} communities (IDs): ${[...joinedCommunityIds].join(', ') || 'None'}`);
            console.log(`[${userId}] User follows ${followingIds.length} users (IDs): ${followingIds.join(', ') || 'None'}`);
            console.log(`[${userId}] Initial categorized IDs (Joined only): ${[...categorizedCommunityIds].join(', ') || 'None'}`);

            let recommendedRaw = [];
            let popularRaw = [];
            let exploreRaw = [];

            // --- 2. Determine Recommended Communities ---
            console.log(`[${userId}] Determining Recommended Communities...`);
            if (followingIds.length > 0) {
                const recommendedQuery = `
                    SELECT
                        c.id, c.title, c.description, c.groupIcon, c.createdAt, c.creatorId, c.memberCount,
                        COUNT(DISTINCT m.memberId) as friendCount
                    FROM (
                        SELECT
                            c_sub.id, c_sub.title, c_sub.description, c_sub.groupIcon, c_sub.createdAt, c_sub.creatorId,
                            (SELECT COUNT(*) FROM members WHERE comId = c_sub.id) AS memberCount
                        FROM communities AS c_sub
                    ) AS c
                    JOIN members m ON c.id = m.comId
                    WHERE m.memberId IN (?)
                      AND c.id NOT IN (?)
                    GROUP BY c.id
                    ORDER BY friendCount DESC, c.memberCount DESC
                    LIMIT 3;
                `;
                const joinedIdsParam = joinedCommunityIds.size > 0 ? Array.from(joinedCommunityIds) : [0]; // Use placeholder if set is empty
                console.log(`[${userId}] Running recommendedQuery with followingIds: [${followingIds.join(', ')}] and excluding joinedIds: [${joinedIdsParam.join(', ')}]`);

                const [recommendedResults] = await db.promise().query(recommendedQuery, [followingIds, joinedIdsParam]);
                recommendedRaw = recommendedResults;

                console.log(`[${userId}] Recommended Raw Results (${recommendedRaw.length}):`, recommendedRaw.map(c => ({id: c.id, title: c.title, friendCount: c.friendCount})));
                recommendedRaw.forEach(c => {
                    if (!categorizedCommunityIds.has(c.id)) { // Avoid double-adding (shouldn't happen with NOT IN, but safe)
                       categorizedCommunityIds.add(c.id);
                    }
                });
            } else {
                console.log(`[${userId}] User follows no one, skipping recommended query.`);
            }
            console.log(`[${userId}] Categorized IDs after recommended (${categorizedCommunityIds.size}): ${[...categorizedCommunityIds].join(', ') || 'None'}`);

            // --- 3. Determine Popular Communities ---
            console.log(`[${userId}] Determining Popular Communities...`);
            const candidatesForPopular = allCommunities
                .filter(c => !categorizedCommunityIds.has(c.id)) // Filter out joined AND recommended
                .sort((a, b) => b.memberCount - a.memberCount); // Sort remaining by member count

            console.log(`[${userId}] Candidates for Popular (${candidatesForPopular.length}) before slicing (Sorted by memberCount):`, candidatesForPopular.map(c => ({id: c.id, title: c.title, memberCount: c.memberCount})));

            popularRaw = candidatesForPopular.slice(0, 5); // Take top 5 of the *remaining*

            console.log(`[${userId}] Popular Raw Results (${popularRaw.length} after slicing top 5):`, popularRaw.map(c => ({id: c.id, title: c.title, memberCount: c.memberCount})));
            popularRaw.forEach(c => {
                 if (!categorizedCommunityIds.has(c.id)) { // Avoid double-adding
                    categorizedCommunityIds.add(c.id);
                 }
            });
            console.log(`[${userId}] Categorized IDs after popular (${categorizedCommunityIds.size}): ${[...categorizedCommunityIds].join(', ') || 'None'}`);

            // --- 4. Determine Explore Communities ---
            console.log(`[${userId}] Determining Explore Communities...`);
            // Filter ALL communities again, excluding everything categorized so far
            exploreRaw = allCommunities
                .filter(c => !categorizedCommunityIds.has(c.id));

            console.log(`[${userId}] Candidates for Explore (${exploreRaw.length}) before shuffling:`, exploreRaw.map(c => ({id: c.id, title: c.title})));

            // Shuffle exploreRaw
            exploreRaw = exploreRaw.sort(() => Math.random() - 0.5);
            console.log(`[${userId}] Explore Raw Results (${exploreRaw.length}) after shuffling.`);


            // --- 5. Process S3 URLs ---
            console.log(`[${userId}] Processing S3 URLs for all categories...`);
            const processList = async (list) => {
                 // ... (processList function remains the same - add logging inside if needed) ...
                 return Promise.all(
                    list.map(async (community) => {
                        let processedCommunity = { ...community };
                        if (processedCommunity.groupIcon && !processedCommunity.groupIcon.startsWith('http')) {
                            try {
                                const groupIconKey = s3KeyFromUrl(processedCommunity.groupIcon);
                                processedCommunity.groupIcon = await generateS3Url(groupIconKey);
                            } catch (error) {
                                console.error(`[${userId}] Error generating S3 URL for community ${processedCommunity.id}:`, error);
                                processedCommunity.groupIcon = null;
                            }
                        }
                        delete processedCommunity.friendCount; // Remove temporary field
                        return processedCommunity;
                    })
                );
            };

            const [finalRecommended, finalPopular, finalExplore] = await Promise.all([
                processList(recommendedRaw),
                processList(popularRaw),
                processList(exploreRaw)
            ]);
            console.log(`[${userId}] S3 URLs processed.`);

            // --- 6. Handle Fallback ---
             const availableCommunities = allCommunities.filter(c => !joinedCommunityIds.has(c.id));
             if (finalRecommended.length === 0 && finalPopular.length === 0 && finalExplore.length === 0 && availableCommunities.length > 0) {
                 console.warn(`[${userId}] Fallback triggered: All categories empty, returning all ${availableCommunities.length} available in explore.`);
                 const allAvailableProcessed = await processList(availableCommunities.sort(() => Math.random() - 0.5));
                 return res.status(200).json({
                    recommended: [],
                    popular: [],
                    explore: allAvailableProcessed
                 });
             }

            // --- 7. Send response ---
            console.log(`[${userId}] Final Response -> Recommended: ${finalRecommended.length}, Popular: ${finalPopular.length}, Explore: ${finalExplore.length}`);
            console.log(`--- [${new Date().toISOString()}] Categorizing communities END for userId: ${userId} ---`);
            res.status(200).json({
                recommended: finalRecommended,
                popular: finalPopular,
                explore: finalExplore
            });

        } catch (err) {
            console.error(`[${userId}] Error fetching categorized communities:`, err);
            const errorMessage = process.env.NODE_ENV === 'production' ? "Failed to fetch communities" : err.message;
            // Avoid logging the full error object to the client in production if it contains sensitive details
            console.log(`--- [${new Date().toISOString()}] Categorizing communities ERROR for userId: ${userId} ---`);
            return res.status(500).json({ message: "Failed to fetch communities", error: errorMessage });
        }
    });
};