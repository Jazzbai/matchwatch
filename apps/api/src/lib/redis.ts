import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
        if (times > 20) {
            console.error('Redis: max retries reached, giving up');
            return null; // stop retrying
        }
        const delay = Math.min(times * 200, 5000);
        return delay;
    },
    lazyConnect: true,
});

let redisErrorLogged = false;

redis.on('error', (err) => {
    if (!redisErrorLogged) {
        console.error('Redis connection error:', err.message);
        redisErrorLogged = true;
    }
});

redis.on('connect', () => {
    redisErrorLogged = false;
    console.log('Redis connected');
});

// Attempt connection (non-blocking)
redis.connect().catch(() => {
    // Error already handled by the error event
});
