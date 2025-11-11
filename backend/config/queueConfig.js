import { Queue } from 'bullmq';
import { redisClient } from './redisConfig.js';

//CREATE A DEDICATED CONNECTION FOR QUEUE
const queueConnection = redisClient.duplicate();

// EMAIL QUEUE CONFIGURATION
export const emailQueue = new Queue('email', {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 3, 
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

// REMEMBER NOTIFICATIONS AND OTHER QUEUE DEPENDENT EVENTS