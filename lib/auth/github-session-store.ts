import { Redis } from '@upstash/redis';
import { getGitHubAuthSessionMaxAgeSeconds } from '@/lib/auth/github';
import type { GitHubSessionData } from '@/lib/auth/github';

const SESSION_PREFIX = 'github_session:';
const inMemorySessions = new Map<string, GitHubSessionData>();

let redisClient: Redis | null = null;
let redisChecked = false;

function getRedisClient(): Redis | null {
  if (redisChecked) {
    return redisClient;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redisChecked = true;

  if (!url || !token) {
    console.warn('Redis環境変数が未設定のためGitHubセッションはメモリ保持になります。');
    return null;
  }

  redisClient = new Redis({ url, token });
  return redisClient;
}

function isSessionExpired(session: GitHubSessionData): boolean {
  return session.expiresAt <= Date.now();
}

export async function createGitHubSession(
  sessionId: string,
  session: GitHubSessionData
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) {
    inMemorySessions.set(sessionId, session);
    return;
  }

  const ttlSeconds = Math.max(
    Math.ceil((session.expiresAt - Date.now()) / 1000),
    getGitHubAuthSessionMaxAgeSeconds(),
    60
  );
  await redis.set(`${SESSION_PREFIX}${sessionId}`, session, { ex: ttlSeconds });
}

export async function getGitHubSession(sessionId: string): Promise<GitHubSessionData | null> {
  const redis = getRedisClient();
  if (!redis) {
    const session = inMemorySessions.get(sessionId);
    if (!session) return null;
    if (isSessionExpired(session)) {
      inMemorySessions.delete(sessionId);
      return null;
    }
    return session;
  }

  const session = await redis.get<GitHubSessionData>(`${SESSION_PREFIX}${sessionId}`);
  if (!session) return null;
  if (isSessionExpired(session)) {
    await redis.del(`${SESSION_PREFIX}${sessionId}`);
    return null;
  }
  return session;
}

export async function deleteGitHubSession(sessionId: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) {
    inMemorySessions.delete(sessionId);
    return;
  }

  await redis.del(`${SESSION_PREFIX}${sessionId}`);
}
