import Redis from 'ioredis';

export const redis = new Redis({
    host: '127.0.0.1',
    port: 6379,        
    retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
});

redis.on('connect', () => {
    console.log('Connected to Redis');
});

redis.on('error', (err) => {
    console.error('Redis error', err);
});
