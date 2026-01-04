import cron from 'node-cron';
import { db } from '../config/connectDB.js';
import { generateBotPost, generateBotComment } from './llmService.js';
import moment from 'moment';
import { getFreshAnimeNews } from './newsAggregatorService.js';

// GET A RANDOM BOT, EXCLUDING CERTAIN USER IDS
const getRandomBot = async (excludeUserIds = []) => {
    
    let query = "SELECT id, core_prompt FROM users WHERE is_bot = TRUE";
    let params = [];
    if (excludeUserIds.length > 0) {
        query += ` AND id NOT IN (?)`;
        params.push(excludeUserIds);
    }
    query += " ORDER BY RAND() LIMIT 1";

    const [bots] = await db.promise().query(query, params);
    return bots.length > 0 ? bots[0] : null;
};

// GET MULTIPLE RANDOM BOTS
const getMultipleBots = async (count, excludeUserIds = []) => {
    let query = "SELECT id, core_prompt FROM users WHERE is_bot = TRUE";
    let params = [];
    if (excludeUserIds.length > 0) {
        query += ` AND id NOT IN (?)`;
        params.push(excludeUserIds);
    }
    query += ` ORDER BY RAND() LIMIT ${count}`;

    const [bots] = await db.promise().query(query, params);
    return bots;
};

// REACTIVE ENGAGEMENT PROCESSING
const runDailyProactivePostingCycle = async () => {
    const postsToCreate = Math.floor(Math.random() * 4) + 5; 
    const usedBotIds = new Set();
        
    console.log(`Scheduler (Proactive Opinions): Aiming to create ${postsToCreate} posts today.`);

    let topics;
    try {
        topics = await getFreshAnimeNews();
        if (topics.length === 0) {
            console.log('Scheduler (Proactive Opinions): No topics fetched. Ending cycle.');
            return;
        }
    } catch (error) {
        console.error('Scheduler (Proactive Opinions): Failed to fetch fresh anime news:', error);
        return;
    }

    for (let i = 0; i < postsToCreate; i++) {
        const bot = await getRandomBot(Array.from(usedBotIds));
        if (!bot) {
            console.log('Scheduler (Proactive Opinions): No more available bots for this cycle.');
            break;
        }

        try {
            // STAGGER POST TIMES SLIGHTLY
            const delayMinutes = i * (5 + Math.floor(Math.random() * 10));
            const postTime = moment().add(delayMinutes, 'minutes').format("YYYY-MM-DD HH:mm:ss");

            const topic = topics[Math.floor(Math.random() * topics.length)];
            const { postText, media } = await generateBotPost(bot.core_prompt, topic);

            if (postText) {
                let finalmedia = null;
                // 80% chance to include the image if it exists
                if (media && Math.random() < 0.8) {
                    finalmedia = media;
                }

                const query = "INSERT INTO posts (userId, description, category, media, createdAt) VALUES (?, ?, ?, ?, ?)";
                const values = [bot.id, postText, 'Discussion', finalmedia, postTime];
                const [result] = await db.promise().execute(query, values);
                const postId = result.insertId;
                
                console.log(`Bot ID ${bot.id} scheduled to post at ${postTime}`);
                usedBotIds.add(bot.id);

                // TRIGGER ORGANIC ENGAGEMENT: Schedule likes and comments
                await scheduleOrgnicEngagementForPost(postId, bot.id, postText, postTime);
            }
        } catch (error) {
            console.error(`Scheduler (Proactive Opinions): Failed to create post for bot ${bot.id}:`, error);
        }
    }
    console.log('Scheduler (Proactive Opinions): Daily posting cycle finished.');
};

// SCHEDULE ORGANIC ENGAGEMENT FOR A POST
const scheduleOrgnicEngagementForPost = async (postId, postAuthorId, postContent) => {
    try {
        // GET RANDOM NUMBER OF BOTS TO LIKE THE POST
        const likeBotCount = Math.floor(Math.random() * 3) + 2; // 2-4 bots
        const likeBots = await getMultipleBots(likeBotCount, [postAuthorId]);
        
        // SCHEDULE LIKES
        for (let i = 0; i < likeBots.length; i++) {
            const delayMinutes = Math.floor(Math.random() * 15) + 1; // 1-15 min delay
            const executeAt = moment().add(delayMinutes, 'minutes').format("YYYY-MM-DD HH:mm:ss");
            
            await db.promise().query(
                "INSERT INTO pending_engagements (post_id, post_author_id, engagement_type, post_content, execute_at, status) VALUES (?, ?, ?, ?, ?, ?)",
                [postId, postAuthorId, 'like', postContent, executeAt, 'pending']
            );
        }

        // GET RANDOM BOT TO COMMENT
        const commentBot = await getRandomBot([postAuthorId, ...likeBots.map(b => b.id)]);
        if (commentBot) {
            const commentDelay = Math.floor(Math.random() * 20) + 10;
            const executeAt = moment().add(commentDelay, 'minutes').format("YYYY-MM-DD HH:mm:ss");
            
            await db.promise().query(
                "INSERT INTO pending_engagements (post_id, post_author_id, engagement_type, post_content, execute_at, status) VALUES (?, ?, ?, ?, ?, ?)",
                [postId, postAuthorId, 'comment', postContent, executeAt, 'pending']
            );
        }

        console.log(`Scheduler: Scheduled ${likeBots.length} likes and 1 comment for post ${postId}`);
    } catch (error) {
        console.error(`Scheduler: Failed to schedule engagement for post ${postId}:`, error);
    }
};

// PROCESS A SINGLE ENGAGEMENT TASK
const processEngagementTask = async (task) => {
    const { id, post_id, post_author_id, engagement_type, post_content } = task;
    try {
        await db.promise().query("UPDATE pending_engagements SET status = 'processing' WHERE id = ?", [id]);
        const bot = await getRandomBot([post_author_id]);
        if (!bot) throw new Error("No bot available for this task.");

        if (engagement_type === 'like') {
            await db.promise().query("INSERT INTO likes (userId, postId) VALUES (?, ?)", [bot.id, post_id]);
            console.log(`Bot ${bot.id} successfully liked post ${post_id}.`);
        } 
        else if (engagement_type === 'comment') {
            try {
                await db.promise().query("INSERT INTO likes (userId, postId) VALUES (?, ?)", [bot.id, post_id]);
                console.log(`Bot ${bot.id} liked post ${post_id} before commenting.`);
            } catch (likeError) {
                if (!likeError.message.includes("Duplicate entry")) throw likeError;
            }

            const commentText = await generateBotComment(bot.core_prompt, post_content);
            if (commentText) {
                const commentQuery = "INSERT INTO comments (`desc`, `userId`, `postId`, `createdAt`) VALUES (?, ?, ?, ?)";
                await db.promise().query(commentQuery, [commentText, bot.id, post_id, moment().format("YYYY-MM-DD HH:mm:ss")]);
                console.log(`Bot ${bot.id} successfully commented on post ${post_id}.`);
            }
        }
        
        await db.promise().query("UPDATE pending_engagements SET status = 'complete' WHERE id = ?", [id]);
    } catch (error) {
        if (engagement_type === 'like' && error.message.includes("Duplicate entry")) {
             await db.promise().query("UPDATE pending_engagements SET status = 'complete' WHERE id = ?", [id]);
        } else {
            console.error(`Scheduler (Reactive): Failed to process task ID ${id} (${engagement_type}):`, error.message);
            await db.promise().query("UPDATE pending_engagements SET status = 'failed' WHERE id = ?", [id]);
        }
    }
};

const checkAndProcessTasks = async () => {
    // CHECK FOR DUE TASKS
    const now = moment().format("YYYY-MM-DD HH:mm:ss");
    const [dueTasks] = await db.promise().query(
        "SELECT * FROM pending_engagements WHERE status = 'pending' AND execute_at <= ? LIMIT 20",
        [now]
    );

    if (dueTasks.length > 0) {
        console.log(`Scheduler (Reactive): Found ${dueTasks.length} total engagement tasks to process.`);
        await Promise.all(dueTasks.map(task => processEngagementTask(task)));
    }
};

// INITIALIZATION 
export const startBotSchedulers = () => {
    //PROACTIVE OPINION POSTING
    const randomHour = Math.floor(Math.random() * 5) + 3;
    cron.schedule(`0 ${randomHour} * * *`, runDailyProactivePostingCycle, { timezone: "UTC" });
    console.log(`Proactive Daily Opinion scheduler started. Will run daily at ${randomHour}:00 UTC.`);
    
    //runDailyProactivePostingCycle();

    // UNIFIES TASK PROCESSSOR (runs every minute)
    cron.schedule('* * * * *', checkAndProcessTasks); 
    console.log('Unified Reactive Engagement processor has been started.');
};