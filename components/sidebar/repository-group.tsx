'use client';

import { ChevronRight, Folder } from 'lucide-react';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { SandboxSession } from '@/types/sandbox';
import { SessionListItem } from './session-list-item';

interface RepositoryGroupProps {
  repoSlug: string;
  sessions: SandboxSession[];
  compact?: boolean;
  onArchiveOptimistic?: (sessionId: string) => void;
  defaultOpen?: boolean;
}

export function RepositoryGroup({
  repoSlug,
  sessions,
  compact = false,
  onArchiveOptimistic,
  defaultOpen = false,
}: RepositoryGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const displayName = repoSlug.split('/').pop() || repoSlug;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground cursor-pointer transition-colors',
            compact && 'justify-center px-1'
          )}
        >
          <ChevronRight className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-90')} />
          {!compact && (
            <>
              <Folder className='h-4 w-4' />
              <span className='truncate'>{displayName}</span>
              <span className='ml-auto text-xs text-muted-foreground/70'>({sessions.length})</span>
            </>
          )}
          {compact && (
            <div className='flex h-6 w-6 items-center justify-center rounded bg-muted text-xs font-bold'>
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className='space-y-1 pl-6'>
        {sessions.map((session) => (
          <SessionListItem
            key={session.id}
            session={session}
            compact={compact}
            onArchiveOptimistic={onArchiveOptimistic}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
