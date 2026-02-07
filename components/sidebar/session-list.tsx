'use client';

import { useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { resolveRepoSlug } from '@/lib/utils';
import type { SandboxSession } from '@/types/sandbox';
import { RepositoryGroup } from './repository-group';

interface SessionListProps {
  sessions: SandboxSession[];
  isLoading?: boolean;
  compact?: boolean;
  onArchiveOptimistic?: (sessionId: string) => void;
}

export function SessionList({
  sessions,
  isLoading = false,
  compact = false,
  onArchiveOptimistic,
}: SessionListProps) {
  const groupedSessions = useMemo(() => {
    const groups = sessions.reduce(
      (acc, session) => {
        const repoSlug = resolveRepoSlug(session);
        if (!acc[repoSlug]) acc[repoSlug] = [];
        acc[repoSlug].push(session);
        return acc;
      },
      {} as Record<string, SandboxSession[]>
    );

    // Sort repositories alphabetically
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([repoSlug, sessions]) => ({ repoSlug, sessions }));
  }, [sessions]);

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

  if (!groupedSessions.length) {
    return <div className='px-4 py-6 text-xs text-muted-foreground'>No sessions found</div>;
  }

  return (
    <ScrollArea className='h-full'>
      <div className={compact ? 'flex flex-col gap-2 px-1 py-3' : 'space-y-2 px-2 py-3'}>
        {groupedSessions.map(({ repoSlug, sessions }, index) => (
          <RepositoryGroup
            key={repoSlug}
            repoSlug={repoSlug}
            sessions={sessions}
            compact={compact}
            onArchiveOptimistic={onArchiveOptimistic}
            defaultOpen={index === 0} // First group open by default
          />
        ))}
      </div>
    </ScrollArea>
  );
}
