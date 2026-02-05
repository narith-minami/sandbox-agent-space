import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { isGitHubAuthEnabled, sanitizeNextPath } from '@/lib/auth/github';

interface LoginPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) || {};
  const nextParam = Array.isArray(params.next) ? params.next[0] : params.next;
  const nextPath = sanitizeNextPath(nextParam || '/');
  const isEnabled = isGitHubAuthEnabled();

  return (
    <div className='mx-auto flex w-full max-w-lg flex-col gap-6 rounded-lg border bg-card p-8 text-card-foreground shadow-sm'>
      <div className='space-y-2'>
        <h1 className='text-2xl font-semibold'>GitHub authentication</h1>
        <p className='text-sm text-muted-foreground'>
          {isEnabled
            ? 'Sign in with GitHub to continue.'
            : 'GitHub authentication is currently disabled.'}
        </p>
      </div>
      <div className='flex flex-col gap-3'>
        {isEnabled ? (
          <Button asChild className='w-full'>
            <Link href={`/api/auth/github?next=${encodeURIComponent(nextPath)}`}>
              Sign in with GitHub
            </Link>
          </Button>
        ) : (
          <Button className='w-full' disabled>
            GitHub authentication is disabled
          </Button>
        )}
        <Button asChild variant='outline' className='w-full'>
          <Link href='/'>Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
