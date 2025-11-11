import express from 'express';
import cors from 'cors';
import { db } from './config/connectDB.js';
import cluster from 'cluster';
import os from 'os';
import cookieParser from 'cookie-parser';
import { config } from 'dotenv';
import http from 'http';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { initializeMessageSocket } from './controllers/community/socket/chats.js';
import AppError from './utils/appError.js';
import logger from './utils/logger.js';

// ROUTES 
import authRoute from './routes/Users/auth.js';
import Users from './routes/Users/users.js';
import SideBar from  './routes/SideBarRoutes/animeMangaLists.js';
import forgottenPasswordRoute from './routes/Users/resetpasswordRoute.js';
import postRoute from './routes/Home/posts.js';
import followRoute from './routes/Home/followers.js';
import Likes from './routes/Home/likes.js';
import Stories from './routes/Home/stories.js';
import Comments from './routes/Home/comments.js';
import Actions from  './routes/Users/userActions.js';
import Stores from './routes/Marketplace/stores.js';
import StoreCatalogs from './routes/Marketplace/catalogRoute.js';
import StoreRatingAndVsits from './routes/Marketplace/ratingsRoute.js';
import News from './routes/newsAndRecommendations.js';
import Communities from './routes/Community/community.js';
import Groups from './routes/Community/communityGroups.js';
import Notifications from './routes/Users/notificationRoute.js';

import { startBotSchedulers } from './services/botSchedulerService.js';

// LOAD ENV VARIABLES
const NODE_ENV = process.env.NODE_ENV || 'development';
config({ path: `.env.${NODE_ENV}` });

console.log(`[ENV] App running in ${NODE_ENV} mode.`);
console.log(`[ENV] Attempting to use REDIS_URL: ${process.env.REDIS_URL}`);

const PORT = process.env.PORT || 8001;

const WHITELIST = [
    'http://localhost:3001',
    'http://localhost:3002',
    'https://beta.weebform.com',
];

const app = express();

// CORS {All Origins}
const corsOptions = {
    origin: true, 
    credentials: true, 
    allowedHeaders: [
      'Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cache-Control'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], 
}; 

// CORS Configuration
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (WHITELIST.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader(
            'Access-Control-Allow-Headers',
            'Content-Type, Authorization'
        );
        res.setHeader(
            'Access-Control-Allow-Methods',
            'GET, POST, PUT, DELETE, OPTIONS'
        );
    }

    if (req.method === 'OPTIONS') {
        return res.status(200).json({});
    }

    next();
});
  
// USE CORS MIDDLEWARE
app.use(cors(corsOptions));

// SECURITY MIDDLEWARE
app.use(helmet());

// REQUEST PARSING
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// LOGGING
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));

// ADD REQUEST TIMESTAMP
app.use((req, res, next) => {
    req.requestTime = new Date().toISOString();
    next();
});

// RATE LIMITING
// const apiLimiter = rateLimit({
//     windowMs: 15 * 60 * 1000,
//     max: 100,
//     standardHeaders: true,
//     message: 'Too many requests from this IP, please try again after 15 minutes',
// });    
// app.use('/api', apiLimiter);

// ROUTES
app.use('/api/v1/user', authRoute);
app.use('/api/v1/user', Users);
app.use('/api/v1/user/actions', Actions);
app.use('/api/v1/user/sidebar', SideBar);
app.use('/api/v1/user', forgottenPasswordRoute);
app.use('/api/v1/posts/', postRoute);
app.use('/api/v1/reach/', followRoute);
app.use('/api/v1/likes', Likes);
app.use('/api/v1/comments', Comments);
app.use('/api/v1/stories', Stories);
app.use('/api/v1/stores', Stores, StoreCatalogs, StoreRatingAndVsits);
app.use('/api/v1/news-content', News);
app.use('/api/v1/communities', Communities);
app.use('/api/v1/communities/groups', Groups);
app.use('/api/v1/notifications', Notifications);
// app.use('/api/v1/communities/groups', CommunityGroupActions); 
 
// HEALTH CHECK ENDPOINT
app.get('/health', async (req, res) => {
    try {
        await db.ping(); // Check DB connectivity
        res.status(200).json({ status: 'healthy', timestamp: new Date() });
    } catch (error) {
        logger.error('Health check failed:', error);
        res.status(500).json({ status: 'degraded', error: error.message });
    }
});

// HANDLE UNKNOWN ROUTES
app.all('*', (req, res, next) => {
    next(new AppError(`Cannot find ${req.originalUrl} on this server`, 404));
});

// GLOBAL ERROR HANDLER
app.use((err, req, res, next) => {
    const statusCode = err.isOperational ? err.statusCode : 500;
    const message = err.isOperational ? err.message : 'Internal Server Error';

    res.status(statusCode).json({
        status: err.status || 'error',
        message: message,
    });

    if (!err.isOperational) {
        logger.error('Unhandled Error:', err);
    }
});

// SHUTDOWN HANDLERS
process.on('SIGINT', () => {
    logger.info('Shutting down server...');
    server.close(() => {
        logger.info('Server closed.');
        process.exit(0);
    });
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    // In a production environment, consider a more aggressive approach
    process.exit(1);
});

// CLUSTER SETUP
if (cluster.isPrimary) {
    const numCPUs = os.cpus(1)

    logger.info(`Master ${process.pid} is running`);

    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        logger.error(`Worker ${worker.process.pid} died with code ${code}, spawning a new one...`);
        cluster.fork();
    });

    (async () => {
        try {
            await db.ping();
            logger.info('Database connection established.');
        } catch (error) {
            logger.error('Failed to connect to database:', error);
            process.exit(1);
        }

        const server = http.createServer(app);

        startBotSchedulers();
        // INITIALIZE WEBSOCKET
        initializeMessageSocket(server);
        server.listen(PORT, () => {
            logger.info(`Server listening on port ${PORT} in ${NODE_ENV} mode`);
        });
    })();
} else {
    logger.info(`Worker ${process.pid} started`);
}