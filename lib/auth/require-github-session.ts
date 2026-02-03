import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  decodeSessionId,
  getGitHubAuthSessionCookieName,
  getGitHubSessionSecret,
  isGitHubAuthEnabled,
} from '@/lib/auth/github';
import { getGitHubSession } from '@/lib/auth/github-session-store';
import type { GitHubSessionData } from '@/lib/auth/github';

export interface RequireGitHubSessionResult {
  sessionId: string;
  session: GitHubSessionData;
}

export async function requireGitHubSession(
  nextPath: string
): Promise<RequireGitHubSessionResult | null> {
  if (!isGitHubAuthEnabled()) {
    return null;
  }

  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(getGitHubAuthSessionCookieName())?.value;
  if (!sessionValue) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  const sessionId = await decodeSessionId(sessionValue, getGitHubSessionSecret());
  if (!sessionId) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  const session = await getGitHubSession(sessionId);
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  return { sessionId, session };
}
