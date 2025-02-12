import express from 'express';
import cors from 'cors';
import cluster from 'cluster';
import os from 'os';
import cookieParser from 'cookie-parser';
import { config } from 'dotenv';
import http from 'http';
import { initializeMessageSocket } from './controllers/community/interactions/generalDiscussions.js'; // Import the Socket.js function

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

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(cors({
  origin: [
    'http://localhost:3001',
    "https://beta.weebform.com"
  ],
  methods: ["GET", "HEAD","POST", "PATCH","PUT", "DELETE", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "Cache-Control"],
}));

config();
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

const port = process.env.PORT || 8001;  
const server = http.createServer(app);

// Initialize WebSocket functionality
initializeMessageSocket(server);

if (cluster.isPrimary) {
  const numCPUs = os.cpus(1);
  for (let i = 0; i < numCPUs; i++) { 
    cluster.fork();
  }

  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} died, spawning a new one.`);
    cluster.fork();
  }); 
 
  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
  }); 
} else {
  console.log(`Worker ${process.pid} started`);
}
