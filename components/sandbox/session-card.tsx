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
  Timer,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useArchiveSession } from '@/hooks/use-archive-session';
import { calculateSessionDuration, extractRepoName } from '@/lib/utils';
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

  const duration = calculateSessionDuration(
    new Date(session.createdAt),
    session.endedAt ? new Date(session.endedAt) : null
  );

  const handleArchiveToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    archiveMutation.mutate({
      sessionId: session.id,
      archived: !session.archived,
    });
  };

  return (
    <>
      {/* Mobile: full-width list item */}
      <div className='md:hidden'>
        <Link href={`/sandbox/${session.id}`} className='block'>
          <div className='flex items-center gap-3 px-4 py-3 active:bg-muted/50'>
            <div className='flex-1 min-w-0'>
              <div className='flex items-center justify-between gap-2 mb-1'>
                <span className='font-medium truncate text-sm' title={session.config.repoSlug}>
                  {extractRepoName(session.config.repoSlug)}
                </span>
                <StatusBadge status={session.status} />
              </div>
              <div className='flex items-center gap-3 text-xs text-muted-foreground'>
                <span className='flex items-center gap-1'>
                  <Clock className='h-3 w-3' />
                  {formattedDate}
                </span>
                <span className='flex items-center gap-1 font-semibold'>
                  <Timer className='h-3 w-3' />
                  {duration}
                </span>
                {session.config.frontDir && (
                  <span className='flex items-center gap-1 truncate'>
                    <GitBranch className='h-3 w-3' />
                    {session.config.frontDir}
                  </span>
                )}
              </div>
              {session.memo && (
                <p className='text-xs text-muted-foreground/80 line-clamp-1 mt-1'>{session.memo}</p>
              )}
            </div>
            <div className='flex items-center gap-1 flex-shrink-0'>
              {session.prUrl && (
                <a
                  href={session.prUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-primary p-1'
                  onClick={(e) => e.stopPropagation()}
                >
                  <GitPullRequest className='h-4 w-4' />
                </a>
              )}
              <Button
                variant='ghost'
                size='icon'
                className='h-8 w-8'
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
            </div>
          </div>
        </Link>
        <div className='border-b mx-4' />
      </div>

      {/* Desktop: card layout */}
      <Card className='hidden md:flex hover:shadow-md transition-shadow'>
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
            <Timer className='h-4 w-4' />
            <span className='font-semibold'>Duration: {duration}</span>
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
    </>
  );
}
