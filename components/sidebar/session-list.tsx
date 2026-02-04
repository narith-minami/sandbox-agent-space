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
    return <div className='px-4 py-6 text-xs text-muted-foreground'>セッションがありません</div>;
  }

  return (
    <ScrollArea className='h-full'>
      <div className={compact ? 'flex flex-col gap-2 px-1 py-3' : 'space-y-2 px-2 py-3'}>
        {sessions.map((session) => (
          <SessionListItem
            key={session.id}
            session={session}
            compact={compact}
            onArchiveOptimistic={onArchiveOptimistic}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
