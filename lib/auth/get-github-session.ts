import { cookies } from 'next/headers';
import type { GitHubSessionData } from '@/lib/auth/github';
import {
  decodeSessionId,
  getGitHubAuthSessionCookieName,
  getGitHubSessionSecret,
  isGitHubAuthEnabled,
} from '@/lib/auth/github';
import { getGitHubSession } from '@/lib/auth/github-session-store';

export interface GetGitHubSessionResult {
  sessionId: string;
  session: GitHubSessionData;
}

/**
 * Gets the GitHub session for API routes without redirecting.
 * Returns null if GitHub auth is disabled or session is not found.
 * Use this in API routes instead of requireGitHubSession to avoid redirect issues.
 */
export async function getGitHubSessionForApi(): Promise<GetGitHubSessionResult | null> {
  if (!isGitHubAuthEnabled()) {
    return null;
  }

  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(getGitHubAuthSessionCookieName())?.value;
  if (!sessionValue) {
    return null;
  }

  const sessionId = await decodeSessionId(sessionValue, getGitHubSessionSecret());
  if (!sessionId) {
    return null;
  }

  const session = await getGitHubSession(sessionId);
  if (!session) {
    return null;
  }

  return { sessionId, session };
}
