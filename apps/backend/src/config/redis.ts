import IORedis from 'ioredis'
import { config } from './env'

export const redis = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
})

redis.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message)
})
