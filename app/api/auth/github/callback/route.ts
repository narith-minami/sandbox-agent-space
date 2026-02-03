import { NextResponse } from 'next/server';
import {
  buildGitHubSessionData,
  decodeState,
  encodeSessionId,
  getGitHubAuthSessionCookieName,
  getGitHubClientId,
  getGitHubClientSecret,
  getGitHubSessionMaxAgeSeconds,
  getGitHubSessionSecret,
  isGitHubAuthEnabled,
  sanitizeNextPath,
} from '@/lib/auth/github';
import { createGitHubSession } from '@/lib/auth/github-session-store';

interface GitHubTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GitHubUserResponse {
  avatar_url: string | null;
  id: number;
  login: string;
  name: string | null;
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!isGitHubAuthEnabled()) {
    return NextResponse.json({ error: 'GitHub認証が無効です。' }, { status: 404 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) {
    return NextResponse.json({ error: 'GitHub認証コードが不足しています。' }, { status: 400 });
  }

  const sessionSecret = getGitHubSessionSecret();
  const decodedNextPath = await decodeState(state, sessionSecret);
  const nextPath = sanitizeNextPath(decodedNextPath);

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: getGitHubClientId(),
      client_secret: getGitHubClientSecret(),
      code,
      redirect_uri: `${url.origin}/api/auth/github/callback`,
    }),
  });

  const tokenData = (await tokenResponse.json()) as GitHubTokenResponse;
  if (!tokenData.access_token) {
    return NextResponse.json(
      { error: tokenData.error_description || 'GitHubトークンの取得に失敗しました。' },
      { status: 401 }
    );
  }

  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${tokenData.access_token}`,
      'User-Agent': 'sandbox-agent-space',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!userResponse.ok) {
    return NextResponse.json(
      { error: 'GitHubユーザー情報の取得に失敗しました。' },
      { status: 401 }
    );
  }

  const userData = (await userResponse.json()) as GitHubUserResponse;
  const sessionData = buildGitHubSessionData(tokenData.access_token, {
    avatarUrl: userData.avatar_url,
    id: userData.id,
    login: userData.login,
    name: userData.name,
  });
  const sessionId = crypto.randomUUID();

  await createGitHubSession(sessionId, sessionData);

  const response = NextResponse.redirect(`${url.origin}${nextPath}`);
  response.cookies.set(
    getGitHubAuthSessionCookieName(),
    await encodeSessionId(sessionId, sessionSecret),
    {
      httpOnly: true,
      maxAge: getGitHubSessionMaxAgeSeconds(),
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    }
  );

  return response;
}
