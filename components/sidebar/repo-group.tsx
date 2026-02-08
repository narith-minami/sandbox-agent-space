'use client';

import { Folder, Pin, PinOff } from 'lucide-react';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { SandboxSession } from '@/types/sandbox';
import { SessionListItem } from './session-list-item';

interface RepoGroupProps {
  repoSlug: string;
  sessions: SandboxSession[];
  onArchiveOptimistic?: (sessionId: string) => void;
  isPinned: (repoSlug: string) => boolean;
  togglePin: (repoSlug: string) => void;
}

export function RepoGroup({
  repoSlug,
  sessions,
  onArchiveOptimistic,
  isPinned,
  togglePin,
}: RepoGroupProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className='grid grid-cols-[auto_1fr_auto_auto] gap-2 items-center rounded-lg px-2 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground'>
        <Folder className='h-4 w-4' />
        <span className='truncate overflow-hidden'>{repoSlug}</span>
        <button
          type='button'
          onClick={(e) => {
            e.stopPropagation();
            togglePin(repoSlug);
          }}
          className='flex items-center gap-1 rounded p-1 hover:bg-muted/50 transition-colors'
          title={isPinned(repoSlug) ? 'Unpin group' : 'Pin group'}
        >
          {isPinned(repoSlug) ? (
            <Pin className='h-3.5 w-3.5 text-red-500' />
          ) : (
            <PinOff className='h-3.5 w-3.5 text-muted-foreground/70' />
          )}
        </button>
        <span className='text-xs text-muted-foreground/70'>{sessions.length}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className='space-y-2 pl-6'>
        {sessions.map((session) => (
          <SessionListItem
            key={session.id}
            session={session}
            onArchiveOptimistic={onArchiveOptimistic}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
