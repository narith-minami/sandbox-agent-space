'use client';

import {
  Archive,
  ArchiveRestore,
  Clock,
  ExternalLink,
  FileText,
  GitBranch,
  GitPullRequest,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useArchiveSession } from '@/hooks/use-archive-session';
import { extractRepoName } from '@/lib/utils';
import type { SandboxSession } from '@/types/sandbox';
import { StatusBadge } from './status-badge';

interface SessionCardProps {
  session: SandboxSession;
}

export function SessionCard({ session }: SessionCardProps) {
  const archiveMutation = useArchiveSession();

  const formattedDate = new Date(session.createdAt).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleArchiveToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    archiveMutation.mutate({
      sessionId: session.id,
      archived: !session.archived,
    });
  };

  return (
    <Card className='hover:shadow-md transition-shadow'>
      <CardHeader className='pb-2'>
        <div className='flex items-center justify-between gap-2 min-w-0'>
          <CardTitle
            className='text-lg font-medium truncate min-w-0'
            title={session.config.repoSlug}
          >
            {extractRepoName(session.config.repoSlug)}
          </CardTitle>
          <StatusBadge status={session.status} />
        </div>
      </CardHeader>
      <CardContent className='space-y-2 text-sm text-muted-foreground'>
        <div className='flex items-center gap-2'>
          <Clock className='h-4 w-4' />
          <span>{formattedDate}</span>
        </div>
        <div className='flex items-center gap-2'>
          <GitBranch className='h-4 w-4' />
          <span className='truncate'>{session.config.frontDir}</span>
        </div>
        {session.memo && (
          <div className='flex items-start gap-2'>
            <FileText className='h-4 w-4 mt-0.5 flex-shrink-0' />
            <p className='text-xs line-clamp-2 text-muted-foreground/80'>{session.memo}</p>
          </div>
        )}
        {session.prUrl && (
          <div className='flex items-center gap-2'>
            <GitPullRequest className='h-4 w-4' />
            <a
              href={session.prUrl}
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary hover:underline truncate flex items-center gap-1'
              onClick={(e) => e.stopPropagation()}
            >
              PR Link
              <ExternalLink className='h-3 w-3' />
            </a>
          </div>
        )}
        {session.sandboxId && (
          <div className='text-xs font-mono bg-muted px-2 py-1 rounded truncate'>
            {session.sandboxId}
          </div>
        )}
      </CardContent>
      <CardFooter className='pt-2 gap-2'>
        <Link href={`/sandbox/${session.id}`} className='flex-1'>
          <Button variant='outline' className='w-full'>
            View Details
          </Button>
        </Link>
        <Button
          variant='ghost'
          size='icon'
          onClick={handleArchiveToggle}
          disabled={archiveMutation.isPending}
          title={session.archived ? 'Restore from archive' : 'Archive session'}
        >
          {archiveMutation.isPending ? (
            <Loader2 className='h-4 w-4 animate-spin' />
          ) : session.archived ? (
            <ArchiveRestore className='h-4 w-4' />
          ) : (
            <Archive className='h-4 w-4' />
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
