import cron from 'node-cron';
import { db } from '../config/connectDB.js';
import { generateBotPost, generateBotComment } from './llmService.js';
import moment from 'moment';
import { getFreshAnimeNews } from './newsAggregatorService.js';

// HELPER: GET A RANDOM BOT, EXCLUDING CERTAIN USER IDS
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


// REACTIVE ENGAGEMENT PROCESSING
const runDailyProactivePostingCycle = async () => {
    const postsToCreate = Math.floor(Math.random() * 4) + 5; 

    const usedBotIds = new Set();
        
    console.log(`Scheduler (Proactive Opinions): Aiming to create ${postsToCreate} posts today.`);

    let topics;
    try {
        topics = await getFreshAnimeNews();
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
            const postContent = await generateBotPost(bot.core_prompt);

            if (postContent) {
                const query = "INSERT INTO posts (userId, description, category, createdAt) VALUES (?, ?, ?, ?)";
                const values = [bot.id, postContent, 'Discussion', moment().format("YYYY-MM-DD HH:mm:ss")];
                await db.promise().execute(query, values);
                console.log(`Bot ID ${bot.id} successfully created a new opinion post.`);
                usedBotIds.add(bot.id);
            }
        } catch (error) {
            console.error(`Scheduler (Proactive Opinions): Failed to create post for bot ${bot.id}:`, error);
        }
    }
    console.log('Scheduler (Proactive Opinions): Daily posting cycle finished.');
};

// UNIFIES FLOW 2: REACTIVE ENGAGEMENT PROCESSING
const processEngagementTask = async (task) => {
    // FUNCTION TO PROCESS A SINGLE ENGAGEMENT TASK
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

// --- INITIALIZATION ---
export const startBotSchedulers = () => {
    // PROACTIVE TASK PROCESSOR (runs once a day at a random morning hour)
    const randomHour = Math.floor(Math.random() * 5) + 3; // Between 3:00 and 7:00 UTC
    cron.schedule(`0 ${randomHour} * * *`, runDailyProactivePostingCycle, { timezone: "UTC" });
    console.log(`Proactive Daily Opinion scheduler started. Will run daily at ${randomHour}:00 UTC.`);
    
    // For immediate testing
    //runDailyProactivePostingCycle();

    // UNIFIES TASK PROCESSSOR (runs every minute)
    cron.schedule('* * * * *', checkAndProcessTasks);
    console.log('Unified Reactive Engagement processor has been started.');
};