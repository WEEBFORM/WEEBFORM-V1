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
import { initializeMessageSocket } from './controllers/community/interactions/generalDiscussions.js';
import { initializeSpoilersSocket } from './controllers/community/interactions/Spoilers.js';
import AppError from './utils/appError.js';
import logger from './utils/logger.js';

// ROUTES
import authRoute from './routes/auth.js';
import Users from './routes/users.js';
import forgottenPasswordRoute from './routes/resetpasswordRoute.js';
import postRoute from './routes/posts.js';
import followRoute from './routes/followers.js';
import Likes from './routes/likes.js';
import Stories from './routes/stories.js';
import Comments from './routes/comments.js';
import Replies from './routes/commentReplies.js';
import Stores from './routes/marketplace.js';
import News from './routes/news.js';
import Communities from './routes/Community/community.js';
import CommunityGroupActions from './routes/Community/interactionsRoute.js';

// Load environment variables early
config();

// Centralize configuration
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 8001;
const WHITELIST = [
    'http://localhost:3001',
    'https://beta.weebform.com',
];

const app = express();

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || WHITELIST.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    allowedHeaders: [
        'Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cache-Control'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
};

// Use CORS middleware
app.use(cors(corsOptions));


// Security Middleware
app.use(helmet());

// Request Parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// Logging
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));

// Add request timestamp
app.use((req, res, next) => {
    req.requestTime = new Date().toISOString();
    next();
});

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    standardHeaders: true,
    message: 'Too many requests from this IP, please try again after 15 minutes',
});
app.use('/api', apiLimiter);

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

// Routes
app.use('/api/v1/user', authRoute);
app.use('/api/v1/user', Users);
app.use('/api/v1/user', forgottenPasswordRoute);
app.use('/api/v1/posts/', postRoute);
app.use('/api/v1/reach/', followRoute);
app.use('/api/v1/likes', Likes);
app.use('/api/v1/comments', Comments);
app.use('/api/v1/replies', Replies);
app.use('/api/v1/stories', Stories);
app.use('/api/v1/stores', Stores);
app.use('/api/v1/news-content', News);
app.use('/api/v1/communities', Communities);
app.use('/api/v1/communities/groups', CommunityGroupActions); 

// Health Check Endpoint
app.get('/health', async (req, res) => {
    try {
        await db.ping(); // Check DB connectivity
        res.status(200).json({ status: 'healthy', timestamp: new Date() });
    } catch (error) {
        logger.error('Health check failed:', error);
        res.status(500).json({ status: 'degraded', error: error.message });
    }
});

// Handle unknown routes
app.all('*', (req, res, next) => {
    next(new AppError(`Cannot find ${req.originalUrl} on this server`, 404));
});

// Global Error Handler
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

// Graceful Shutdown
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
    process.exit(1); // Terminate the process
});

// Clustering Setup
if (cluster.isPrimary) {
    const numCPUs = os.cpus().length;

    logger.info(`Master ${process.pid} is running`);

    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        logger.error(`Worker ${worker.process.pid} died with code ${code}, spawning a new one...`);
        cluster.fork();
    });

    // Connect to database and then start server
    (async () => {
        try {
            await db.ping(); // Test the database connection
            logger.info('Database connection established.');
        } catch (error) {
            logger.error('Failed to connect to database:', error);
            process.exit(1); // Exit if database connection fails in primary process
        }

        const server = http.createServer(app);

        // Initialize WebSocket functionality
        initializeMessageSocket(server);
        initializeSpoilersSocket(server);
        server.listen(PORT, () => {
            logger.info(`Server listening on port ${PORT} in ${NODE_ENV} mode`);
        });
    })();
} else {
    // Worker process
    logger.info(`Worker ${process.pid} started`);
}