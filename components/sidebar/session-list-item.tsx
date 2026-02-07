'use client';

import { Archive, CheckCircle2, Clock, Loader2, StopCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { calculateSessionDuration, cn, extractRepoName, resolveRepoSlug } from '@/lib/utils';
import type { SandboxSession, SessionStatus } from '@/types/sandbox';
import { PrStatusBadge } from './pr-status-badge';

interface SessionListItemProps {
  session: SandboxSession;
  compact?: boolean;
  onArchiveOptimistic?: (sessionId: string) => void;
}

const statusConfig: Record<
  SessionStatus,
  {
    label: string;
    icon: typeof Loader2;
    textClassName: string;
    dotClassName: string;
  }
> = {
  pending: {
    label: 'Pending',
    icon: Clock,
    textClassName: 'text-slate-500',
    dotClassName: 'bg-slate-400',
  },
  running: {
    label: 'Running',
    icon: Loader2,
    textClassName: 'text-sky-500',
    dotClassName: 'bg-sky-500',
  },
  stopping: {
    label: 'Stopping',
    icon: StopCircle,
    textClassName: 'text-amber-500',
    dotClassName: 'bg-amber-500',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    textClassName: 'text-emerald-500',
    dotClassName: 'bg-emerald-500',
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    textClassName: 'text-rose-500',
    dotClassName: 'bg-rose-500',
  },
};

function formatSessionDate(createdAt: Date | string): string {
  const date = new Date(createdAt);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');

  if (isToday) {
    return `Today ${hours}:${minutes}`;
  }

  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
}

function truncateRepoSlug(slug: string, maxLength = 25): string {
  // Display only the repo name (without org prefix)
  const repoName = extractRepoName(slug);
  if (repoName.length <= maxLength) return repoName;
  return `${repoName.slice(0, maxLength)}...`;
}

function extractPrNumber(prUrl: string | null | undefined): string | null {
  if (!prUrl) return null;
  try {
    const match = prUrl.match(/\/pull\/(\d+)/);
    return match ? `#${match[1]}` : null;
  } catch {
    return null;
  }
}

export function SessionListItem({
  session,
  compact = false,
  onArchiveOptimistic,
}: SessionListItemProps) {
  const config = statusConfig[session.status];
  const StatusIcon = config.icon;
  const repoSlug = resolveRepoSlug(session);
  const truncatedRepoSlug = truncateRepoSlug(repoSlug);
  const formattedDate = formatSessionDate(session.createdAt);
  const prNumber = extractPrNumber(session.prUrl);
  // Show duration if session has ended, or if it's currently running
  const shouldShowDuration = session.endedAt || session.status === 'running';
  const duration = shouldShowDuration
    ? calculateSessionDuration(
        new Date(session.createdAt),
        session.endedAt ? new Date(session.endedAt) : null
      )
    : null;
  const [isHovered, setIsHovered] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const handleArchive = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isArchiving) return;

    setIsArchiving(true);

    try {
      // Perform async archive first
      const response = await fetch(`/api/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true }),
      });

      if (!response.ok) {
        throw new Error('Failed to archive session');
      }

      // Show success toast before removing from list
      toast.success('Session archived successfully');

      // Small delay to ensure toast is visible
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Optimistically remove from list after toast
      if (onArchiveOptimistic) {
        onArchiveOptimistic(session.id);
      }
    } catch (error) {
      console.error('Failed to archive session:', error);
      toast.error('Failed to archive session');
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div className='relative'>
      <Link
        href={`/sandbox/${session.id}`}
        className={cn(
          'group flex items-center gap-3 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-muted/40',
          compact && 'justify-center px-1',
          !compact && 'pr-11'
        )}
        title={`${repoSlug} / ${config.label} / ${formattedDate}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full bg-muted/40',
            config.textClassName
          )}
        >
          <StatusIcon className={cn('h-4 w-4', session.status === 'running' && 'animate-spin')} />
        </div>

        {!compact && (
          <div className='flex min-w-0 flex-1 flex-col gap-1'>
            <div className='flex items-center justify-between gap-2'>
              <span className='truncate text-sm font-medium' title={repoSlug}>
                {truncatedRepoSlug}
              </span>
            </div>
            <div className='flex items-center gap-2 text-xs text-muted-foreground'>
              <span className='flex items-center gap-1.5'>
                <span className={cn('h-2 w-2 rounded-full', config.dotClassName)} />
                <span className='text-muted-foreground/70'>{formattedDate}</span>
              </span>
              {duration && (
                <span className='font-semibold text-muted-foreground/70'>({duration})</span>
              )}
              {session.prStatus && <PrStatusBadge status={session.prStatus} compact={false} />}
              {prNumber && (
                <span className='text-xs font-medium text-muted-foreground/70'>{prNumber}</span>
              )}
            </div>
          </div>
        )}
      </Link>

      {!compact && !session.archived && isHovered && (
        <Button
          variant='ghost'
          size='icon'
          className='absolute right-3 top-1/2 z-10 h-6 w-6 -translate-y-1/2 bg-background/95 shadow-sm backdrop-blur-sm hover:bg-background'
          onClick={handleArchive}
          disabled={isArchiving}
          title='Archive'
        >
          <Archive className='h-3.5 w-3.5' />
        </Button>
      )}
    </div>
  );
}
