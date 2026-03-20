import { Redis } from 'ioredis';
import { config } from '../config.js';

export const redisClient = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: 1,
  lazyConnect: true,
});

export async function checkRedisConnection(): Promise<void> {
  if (redisClient.status === 'wait') {
    await redisClient.connect();
  }
  await redisClient.ping();
}

