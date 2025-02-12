import express from 'express';
import cors from 'cors';
import cluster from 'cluster';
import os from 'os';
import cookieParser from 'cookie-parser';
import { config } from 'dotenv';
import http from 'http';
import { initializeMessageSocket } from './controllers/community/interactions/generalDiscussions.js'; // Import the Socket.js function
import { initializeSpoilersSocket } from './controllers/community/interactions/Spoilers.js';

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

const app = express();
config(); // Load environment variables

// Apply middleware to ensure consistency across workers
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Handle CORS dynamically
const whitelist = [
  'http://localhost:3001',
  'https://beta.weebform.com',
];
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (whitelist.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
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

// Configure the server
const port = process.env.PORT || 8001;
const server = http.createServer(app);

// Initialize WebSocket functionality
initializeMessageSocket(server);
initializeSpoilersSocket(server);

// Trust proxy for handling AWS load balancers and forwarded headers
app.set('trust proxy', true);

if (cluster.isPrimary) {
  const numCPUs = os.cpus(1);
  
  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} died, spawning a new one.`);
    cluster.fork();
  });

  // Primary process listens to the port
  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
} else {
  // Worker process logs startup
  console.log(`Worker ${process.pid} started`);
}
