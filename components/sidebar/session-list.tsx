'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import type { SandboxSession } from '@/types/sandbox';
import { SessionListItem } from './session-list-item';

interface SessionListProps {
  sessions: SandboxSession[];
  isLoading?: boolean;
  compact?: boolean;
  onArchiveOptimistic?: (sessionId: string) => void;
}

function resolveRepoSlug(session: SandboxSession): string {
  if (session.config.repoSlug) return session.config.repoSlug;

  if (session.config.repoUrl) {
    try {
      const url = new URL(session.config.repoUrl);
      const [owner, repo] = url.pathname.split('/').filter(Boolean);
      if (owner && repo) return `${owner}/${repo}`;
    } catch {
      return 'unknown/repo';
    }
  }

  return 'unknown/repo';
}

function groupSessionsByRepo(sessions: SandboxSession[]): Map<string, SandboxSession[]> {
  const groups = new Map<string, SandboxSession[]>();

  for (const session of sessions) {
    const repoSlug = resolveRepoSlug(session);
    const existing = groups.get(repoSlug) || [];
    existing.push(session);
    groups.set(repoSlug, existing);
  }

  return groups;
}

function getSessionTimestamp(session: SandboxSession): number {
  const timestamp = new Date(session.createdAt).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function sortGroupsByNewestSession(
  groups: Map<string, SandboxSession[]>
): [string, SandboxSession[]][] {
  const groupsWithTimestamp = Array.from(groups.entries()).map(([repoSlug, sessions]) => ({
    repoSlug,
    sessions,
    newestTimestamp: Math.max(0, ...sessions.map(getSessionTimestamp)),
  }));

  groupsWithTimestamp.sort((a, b) => b.newestTimestamp - a.newestTimestamp);

  return groupsWithTimestamp.map(({ repoSlug, sessions }) => [repoSlug, sessions]);
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

  // Group sessions by repository
  const groups = groupSessionsByRepo(sessions);
  const sortedGroups = sortGroupsByNewestSession(groups);

  return (
    <ScrollArea className='h-full'>
      <div className={compact ? 'flex flex-col gap-2 px-1 py-3' : 'space-y-4 px-2 py-3'}>
        {sortedGroups.map(([repoSlug, repoSessions]) => {
          // Sort sessions within group by createdAt desc
          const sortedSessions = [...repoSessions].sort(
            (a, b) => getSessionTimestamp(b) - getSessionTimestamp(a)
          );

          if (compact) {
            return sortedSessions.map((session) => (
              <SessionListItem
                key={session.id}
                session={session}
                compact={compact}
                onArchiveOptimistic={onArchiveOptimistic}
              />
            ));
          }

          return (
            <div key={repoSlug} className='space-y-2'>
              <div className='px-2 py-1 text-xs font-medium text-muted-foreground border-b border-border/50'>
                {repoSlug}
              </div>
              {sortedSessions.map((session) => (
                <SessionListItem
                  key={session.id}
                  session={session}
                  compact={compact}
                  onArchiveOptimistic={onArchiveOptimistic}
                />
              ))}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
