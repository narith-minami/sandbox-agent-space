import { Redis } from '@upstash/redis';

// Lazy initialization for Redis client
let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (!_redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    
    if (!url || !token) {
      console.warn('Redis environment variables not set. Rate limiting disabled.');
      return null;
    }
    
    _redis = new Redis({ url, token });
  }
  return _redis;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

/**
 * Rate limiter using Upstash Redis
 * Uses sliding window algorithm
 */
export async function checkRateLimit(
  identifier: string,
  maxRequests = 10,
  windowSeconds = 3600
): Promise<RateLimitResult> {
  const redis = getRedis();
  
  // If Redis is not configured, allow all requests
  if (!redis) {
    return {
      success: true,
      remaining: maxRequests,
      reset: windowSeconds,
    };
  }

  const key = `rate_limit:${identifier}`;
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;

  try {
    // Remove old entries
    await redis.zremrangebyscore(key, 0, windowStart);

    // Count current requests in window
    const requestCount = await redis.zcard(key);

    if (requestCount >= maxRequests) {
      // Get the oldest request timestamp to calculate reset time
      const oldestRequests = await redis.zrange<{ score: number; member: string }[]>(key, 0, 0, { withScores: true });
      const oldestTimestamp = oldestRequests.length > 0 && typeof oldestRequests[0] === 'object' && 'score' in oldestRequests[0] 
        ? oldestRequests[0].score 
        : now;
      const resetTime = Math.ceil((oldestTimestamp + windowSeconds * 1000 - now) / 1000);

      return {
        success: false,
        remaining: 0,
        reset: resetTime,
      };
    }

    // Add current request
    await redis.zadd(key, { score: now, member: `${now}:${Math.random()}` });
    
    // Set expiry on the key
    await redis.expire(key, windowSeconds);

    return {
      success: true,
      remaining: maxRequests - requestCount - 1,
      reset: windowSeconds,
    };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // On error, allow the request but log it
    return {
      success: true,
      remaining: maxRequests,
      reset: windowSeconds,
    };
  }
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
  };
}

/**
 * Helper to get client IP from request
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  return 'unknown';
}
