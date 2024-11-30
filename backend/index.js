import express from "express";
import cors from "cors";
import cluster from "cluster";
import os from "os";
import cookieParser from "cookie-parser";
import { config } from "dotenv";
import http from 'http';
import { WebSocketServer } from 'ws';
import {S3Client} from "@aws-sdk/client-s3"
config({ path: '/etc/app.env' });

// ROUTES  
import authRoute from "./routes/auth.js";
import Users from "./routes/users.js";
import forgottenPasswordRoute from "./routes/resetpasswordRoute.js";
import postRoute from "./routes/posts.js";
import followRoute from "./routes/followers.js";
import Likes from "./routes/likes.js";
import Stories from "./routes/stories.js";
import Comments from "./routes/comments.js";
import Replies from "./routes/commentReplies.js";
import Stores from "./routes/marketplace.js";
import Communities from "./routes/Community/community.js";

const app = express();

// MIDDLEWARES AND CONTROLLERS
app.use(express.json());
app.use(cors());
app.use(cookieParser());
app.use('/uploads', express.static('uploads'));
app.use(express.urlencoded({ extended: true }));
config();
app.use('/api/v1/user', authRoute);
app.use('/api/v1/user', Users);
app.use('/api/v1/user', forgottenPasswordRoute); 
app.use('/api/v1/posts/', postRoute);  
app.use('/api/v1/reach/', followRoute);
app.use(Likes);
app.use('/api/v1/comments', Comments);
app.use('/api/v1/replies', Replies);
app.use('/api/v1/stories', Stories);
app.use('/api/v1/stores', Stores);
app.use('/api/v1/communities', Communities);

const port = process.env.PORT || 8080;

// HTTP SERVER
const server = http.createServer(app);

//LOAD BALANCING
//`if (cluster.isPrimary) {
  //const CPUNum = os.cpus().length;
  //console.log(`Primary ${process.pid} is running`);

  //for (let i = 0; i < CPUNum; i++) {
      //cluster.fork();
 // }
  //cluster.on('exit', (worker, code, signal) => {
      //console.log(`Worker ${worker.process.pid} died. Starting a new worker...`);
    //  cluster.fork();
  //});

//} else {
      //console.log(`Worker ${process.pid} started, server running on port ${port}`);
//}`

// WEBSOCKET SERVER
// const wss = new WebSocketServer({ server });

// wss.on('connection', (ws, request) => {
//     const userId = request.url.slice(1);

//     console.log(`WebSocket connection established with user ${userId}`);
  
//     ws.on('message', (message) => {
//       console.log(`Received message ${message} from user ${userId}`);
      
//       // Broadcast the message to all other connected clients
//       wss.clients.forEach((client) => {
//         if (client !== ws && client.readyState === WebSocketServer.OPEN) {
//           client.send(`User ${userId} says: ${message}`);
//         }
//       });
//     });
  
//     ws.on('close', () => {
//       console.log(`WebSocket connection with user ${userId} closed`);
//     });
//     ws.send('WSS working fine')
// });

// // const IP = process.env.PUBLIC_IP;

// process.on('uncaughtException', (err) => {
//   console.error('Uncaught Exception:', err);
//   process.exit(1); // Exit and let the process manager restart the app
// });

// process.on('unhandledRejection', (reason, promise) => {
//   console.error('Unhandled Rejection at:', promise, 'reason:', reason);
//   process.exit(1); // Exit and let the process manager restart the app
// });
 
server.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
});