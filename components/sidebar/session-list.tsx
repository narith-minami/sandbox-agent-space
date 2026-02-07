'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { resolveRepoSlug } from '@/lib/utils';
import type { SandboxSession } from '@/types/sandbox';
import { RepoGroup } from './repo-group';

interface SessionListProps {
  sessions: SandboxSession[];
  isLoading?: boolean;
  compact?: boolean;
  onArchiveOptimistic?: (sessionId: string) => void;
}

function groupSessionsByRepo(sessions: SandboxSession[]): Record<string, SandboxSession[]> {
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

  // Sort groups by most recent session (latest updatedAt or createdAt)
  const sortedGroups = Object.entries(groups).sort(([, a], [, b]) => {
    const aLatest = Math.max(...a.map((s) => new Date(s.updatedAt || s.createdAt).getTime()));
    const bLatest = Math.max(...b.map((s) => new Date(s.updatedAt || s.createdAt).getTime()));
    return bLatest - aLatest;
  });

  // Convert back to record
  const result: Record<string, SandboxSession[]> = {};
  sortedGroups.forEach(([repoSlug, sessions]) => {
    result[repoSlug] = sessions;
  });

  return result;
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
          ? // In compact mode, render sessions directly without grouping
            sessions.map((session) => (
              <RepoGroup
                key={resolveRepoSlug(session)}
                repoSlug={resolveRepoSlug(session)}
                sessions={[session]}
                compact={compact}
                onArchiveOptimistic={onArchiveOptimistic}
              />
            ))
          : // Group sessions by repository
            Object.entries(groupSessionsByRepo(sessions)).map(([repoSlug, repoSessions]) => (
              <RepoGroup
                key={repoSlug}
                repoSlug={repoSlug}
                sessions={repoSessions}
                compact={compact}
                onArchiveOptimistic={onArchiveOptimistic}
              />
            ))}
      </div>
    </ScrollArea>
  );
}
