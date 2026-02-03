import Link from 'next/link';
import { cookies } from 'next/headers';
import { Button } from '@/components/ui/button';
import {
  decodeSessionId,
  getGitHubAuthSessionCookieName,
  getGitHubSessionSecret,
  isGitHubAuthEnabled,
} from '@/lib/auth/github';
import { getGitHubSession } from '@/lib/auth/github-session-store';

export async function AuthStatus() {
  if (!isGitHubAuthEnabled()) {
    return null;
  }

  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(getGitHubAuthSessionCookieName())?.value;
  const sessionId = sessionValue ? await decodeSessionId(sessionValue, getGitHubSessionSecret()) : null;
  const session = sessionId ? await getGitHubSession(sessionId) : null;

  if (!session) {
    return (
      <Button asChild size='sm'>
        <Link href='/login'>ログイン</Link>
      </Button>
    );
  }

  return (
    <div className='flex items-center gap-3 text-sm'>
      <div className='flex items-center gap-2'>
        <span className='text-muted-foreground'>@{session.user.login}</span>
      </div>
      <form action='/api/auth/github/logout' method='post'>
        <Button size='sm' variant='outline' type='submit'>
          ログアウト
        </Button>
      </form>
    </div>
  );
}
