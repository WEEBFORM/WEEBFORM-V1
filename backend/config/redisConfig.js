import Redis from 'ioredis';
export { redisClient };

//CONSTANTS
export const USER_CACHE_TTL = 300; // 5 minutes
export const VERIFICATION_CODE_TTL = 600;
export const PROFILE_CACHE_TTL = 600; // 10 minutes
export const ANALYTICS_CACHE_TTL = 900;


let redisClient; 

if (process.env.REDIS_URL) {
  const isSecure = process.env.REDIS_URL.startsWith('rediss://');
  
  // DISABLE TLS FOR NON-SECURE CONNECTIONS
  redisClient = new Redis(process.env.REDIS_URL, {
    tls: isSecure ? { minVersion: 'TLSv1.2' } : false,
    maxRetriesPerRequest: process.env.NODE_ENV === 'production' ? 10 : 3,
    enableReadyCheck: true,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      console.log(`Redis: Retrying connection (attempt ${times}), delay ${delay}ms`);
      return delay;
    }, 
  });
} else { 
  const redisOptions = { 
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB_INDEX, 10) || 0,
    maxRetriesPerRequest: process.env.NODE_ENV === 'production' ? 10 : 3,
    enableReadyCheck: true,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      console.log(`Redis: Retrying connection (attempt ${times}), delay ${delay}ms`);
      return delay;
    },
    tls: false,
  };

  redisClient = new Redis(redisOptions);
}



// Event listeners
redisClient.on('connect', () => {
  console.log('Connected to Redis');
});

redisClient.on('ready', () => {
  console.log('Redis client is ready to use');
});

redisClient.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redisClient.on('close', () => {
  console.log('Redis connection closed');
});

redisClient.on('reconnecting', (delay) => {
  console.log(`Redis reconnecting in ${delay}ms...`);
});

redisClient.on('end', () => {
  console.log('Redis connection ended. No more reconnections will be attempted.');
});