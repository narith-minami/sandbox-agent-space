import { beforeEach, describe, expect, it, vi } from 'vitest';

const redisMocks = vi.hoisted(() => {
  return {
    zremrangebyscore: vi.fn(),
    zcard: vi.fn(),
    zrange: vi.fn(),
    zadd: vi.fn(),
    expire: vi.fn(),
  };
});

vi.mock('@upstash/redis', () => {
  class RedisMock {
    constructor() {
      Object.assign(this, redisMocks);
    }
  }

  return {
    Redis: RedisMock,
  };
});

async function loadRateLimitModule() {
  return import('@/lib/rate-limit');
}

describe('rate limit utilities', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    redisMocks.zremrangebyscore.mockReset();
    redisMocks.zcard.mockReset();
    redisMocks.zrange.mockReset();
    redisMocks.zadd.mockReset();
    redisMocks.expire.mockReset();
  });

  it('allows all requests when Redis env vars are missing', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.resetModules();

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { checkRateLimit } = await loadRateLimitModule();
    const result = await checkRateLimit('user-1', 5, 60);

    expect(result).toEqual({
      success: true,
      remaining: 5,
      reset: 60,
    });
    expect(warnSpy).toHaveBeenCalledWith(
      'Redis environment variables not set. Rate limiting disabled.'
    );
    warnSpy.mockRestore();
  });

  it('records requests and returns remaining count when under limit', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.com');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token');
    vi.resetModules();

    const now = 10_000;
    vi.useFakeTimers();
    vi.setSystemTime(now);

    redisMocks.zremrangebyscore.mockResolvedValue(0);
    redisMocks.zcard.mockResolvedValue(3);
    redisMocks.zadd.mockResolvedValue(1);
    redisMocks.expire.mockResolvedValue(1);

    const { checkRateLimit } = await loadRateLimitModule();
    const result = await checkRateLimit('user-2', 5, 60);

    expect(result).toEqual({
      success: true,
      remaining: 1,
      reset: 60,
    });
    expect(redisMocks.zadd).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('blocks requests and returns reset time when limit exceeded', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.com');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token');
    vi.resetModules();

    const now = 10_000;
    vi.useFakeTimers();
    vi.setSystemTime(now);

    redisMocks.zremrangebyscore.mockResolvedValue(0);
    redisMocks.zcard.mockResolvedValue(5);
    redisMocks.zrange.mockResolvedValue([{ score: 6_000, member: 'oldest' }]);

    const { checkRateLimit } = await loadRateLimitModule();
    const result = await checkRateLimit('user-3', 5, 10);

    expect(result).toEqual({
      success: false,
      remaining: 0,
      reset: 6,
    });
    expect(redisMocks.zadd).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('fails open if Redis errors occur', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.com');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token');
    vi.resetModules();

    const error = new Error('Redis down');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    redisMocks.zremrangebyscore.mockRejectedValue(error);

    const { checkRateLimit } = await loadRateLimitModule();
    const result = await checkRateLimit('user-4', 4, 30);

    expect(result).toEqual({
      success: true,
      remaining: 4,
      reset: 30,
    });
    expect(errorSpy).toHaveBeenCalledWith('Rate limit check failed:', error);
    errorSpy.mockRestore();
  });

  it('formats headers from a rate limit result', async () => {
    const { getRateLimitHeaders } = await loadRateLimitModule();
    const headers = getRateLimitHeaders({ success: true, remaining: 2, reset: 120 });

    expect(headers).toEqual({
      'X-RateLimit-Remaining': '2',
      'X-RateLimit-Reset': '120',
    });
  });

  it('extracts client IP from forwarded or real headers', async () => {
    const { getClientIp } = await loadRateLimitModule();

    const forwardedRequest = new Request('https://example.com', {
      headers: {
        'x-forwarded-for': '203.0.113.5, 70.41.3.18',
      },
    });
    const realIpRequest = new Request('https://example.com', {
      headers: {
        'x-real-ip': '198.51.100.2',
      },
    });
    const unknownRequest = new Request('https://example.com');

    expect(getClientIp(forwardedRequest)).toBe('203.0.113.5');
    expect(getClientIp(realIpRequest)).toBe('198.51.100.2');
    expect(getClientIp(unknownRequest)).toBe('unknown');
  });
});
