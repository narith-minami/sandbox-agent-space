'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { resolveRepoSlug } from '@/lib/utils';
import type { SandboxSession } from '@/types/sandbox';
import { RepoGroup } from './repo-group';
import { SessionListItem } from './session-list-item';

interface SessionListProps {
  sessions: SandboxSession[];
  isLoading?: boolean;
  compact?: boolean;
  onArchiveOptimistic?: (sessionId: string) => void;
}

function groupSessionsByRepo(sessions: SandboxSession[]): [string, SandboxSession[]][] {
  const groups: Record<string, SandboxSession[]> = {};

  // Group sessions by repo slug
  sessions.forEach((session) => {
    const repoSlug = resolveRepoSlug(session);
    if (!groups[repoSlug]) {
      groups[repoSlug] = [];
    }
    groups[repoSlug].push(session);
  });

  // Sort sessions within each group by createdAt descending
  Object.keys(groups).forEach((repoSlug) => {
    groups[repoSlug].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  });

  return Object.entries(groups).sort(([, a], [, b]) => {
    const aLatest = Math.max(...a.map((s) => new Date(s.updatedAt || s.createdAt).getTime()));
    const bLatest = Math.max(...b.map((s) => new Date(s.updatedAt || s.createdAt).getTime()));
    return bLatest - aLatest;
  });
}

export function SessionList({
  sessions,
  isLoading = false,
  compact = false,
  onArchiveOptimistic,
}: SessionListProps) {
  if (isLoading) {
    const skeletonKeys = ['s1', 's2', 's3', 's4', 's5', 's6'];

    return (
      <div className='space-y-2 px-2 py-3'>
        {skeletonKeys.map((key) => (
          <Skeleton key={key} className='h-10 w-full rounded-lg' />
        ))}
      </div>
    );
  }

  if (!sessions.length) {
    return <div className='px-4 py-6 text-xs text-muted-foreground'>No sessions found</div>;
  }

  return (
    <ScrollArea className='h-full'>
      <div className={compact ? 'flex flex-col gap-2 px-1 py-3' : 'space-y-2 px-2 py-3'}>
        {compact
          ? sessions.map((session) => (
              <SessionListItem
                key={session.id}
                session={session}
                compact={compact}
                onArchiveOptimistic={onArchiveOptimistic}
              />
            ))
          : groupSessionsByRepo(sessions).map(([repoSlug, repoSessions]) => (
              <RepoGroup
                key={repoSlug}
                repoSlug={repoSlug}
                sessions={repoSessions}
                onArchiveOptimistic={onArchiveOptimistic}
              />
            ))}
      </div>
    </ScrollArea>
  );
}
