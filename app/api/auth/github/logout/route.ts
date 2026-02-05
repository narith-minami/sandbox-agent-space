import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  decodeSessionId,
  getGitHubAuthSessionCookieName,
  getGitHubSessionSecret,
  isGitHubAuthEnabled,
} from '@/lib/auth/github';
import { deleteGitHubSession } from '@/lib/auth/github-session-store';

export async function POST(request: Request): Promise<NextResponse> {
  if (!isGitHubAuthEnabled()) {
    return NextResponse.json({ error: 'GitHub authentication is disabled.' }, { status: 404 });
  }

  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(getGitHubAuthSessionCookieName())?.value;
  if (sessionValue) {
    const sessionId = await decodeSessionId(sessionValue, getGitHubSessionSecret());
    if (sessionId) {
      await deleteGitHubSession(sessionId);
    }
  }

  const url = new URL(request.url);
  const response = NextResponse.redirect(`${url.origin}/login`);
  response.cookies.set(getGitHubAuthSessionCookieName(), '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}
