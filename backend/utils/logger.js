import winston from 'winston';
import { config } from 'dotenv';

// Load environment variables
config();

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6,
};

// Create the logger
const logger = winston.createLogger({
  levels: logLevels,
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug', // Only log `info` and above in production
  format: winston.format.combine(
    winston.format.colorize(), // Add color to the console
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), // Timestamp each log
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${level}: ${message}`;
    })
  ),
  transports: [
    // Write all logs to `app.log`
    new winston.transports.File({ filename: 'logs/app.log', level: 'info' }),
    // Write error logs to `error.log`
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    // Log to the console in development
    new winston.transports.Console(),
  ],
});

// Stream method for morgan integration
logger.stream = {
  write: (message) => {
    logger.http(message.trim()); // Log HTTP requests using `http` level
  },
};

export default logger;
