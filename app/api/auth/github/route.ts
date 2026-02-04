import { NextResponse } from 'next/server';
import {
  encodeState,
  getGitHubClientId,
  getGitHubSessionSecret,
  isGitHubAuthEnabled,
  sanitizeNextPath,
} from '@/lib/auth/github';

export async function GET(request: Request): Promise<NextResponse> {
  if (!isGitHubAuthEnabled()) {
    return NextResponse.json({ error: 'GitHub認証が無効です。' }, { status: 404 });
  }

  const url = new URL(request.url);
  const nextPath = sanitizeNextPath(url.searchParams.get('next'));
  const clientId = getGitHubClientId();
  const state = await encodeState(nextPath, getGitHubSessionSecret());
  const redirectUrl = new URL('https://github.com/login/oauth/authorize');

  redirectUrl.searchParams.set('client_id', clientId);
  redirectUrl.searchParams.set('redirect_uri', `${url.origin}/api/auth/github/callback`);
  redirectUrl.searchParams.set('scope', 'read:user');
  redirectUrl.searchParams.set('state', state);

  return NextResponse.redirect(redirectUrl.toString());
}
