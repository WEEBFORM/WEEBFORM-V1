import { Worker } from 'bullmq';
import { config } from 'dotenv';
import { transporter } from '../middlewares/mailTransportConfig.js';
import logger from '../utils/logger.js';
import { redisClient } from '../config/redisConfig.js';

// LOAD ENV
const NODE_ENV = process.env.NODE_ENV || 'development';
config({ path: `.env.${NODE_ENV}` });

// CONNECTION FOR WORKER
const workerConnection = redisClient.duplicate();
logger.info('Worker process started, waiting for jobs...');

const emailWorker = new Worker('email', async (job) => {
    logger.info(`Processing email job '${job.name}' with ID ${job.id}`);
    
    // PASSING JOB DATA FROM RESPONSE
    const { to, subject, html } = job.data;
    
    if (!to || !subject || !html) {
        throw new Error(`Invalid mail data for job ${job.id}`);
    }

    // SEND MAIL USING TRANSPORTER
    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: to,
        subject: subject,
        html: html,
    });

}, { connection: workerConnection });

// EVENT LISTNERS FOR WORKER
emailWorker.on('completed', (job) => {
    logger.info(`Job ${job.id} (type: ${job.name}) has completed.`);
});

emailWorker.on('failed', (job, err) => {
    logger.error(`Job ${job.id} (type: ${job.name}) has failed with error: ${err.message}`);
});