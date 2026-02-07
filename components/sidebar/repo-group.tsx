'use client';

import { Folder } from 'lucide-react';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { SandboxSession } from '@/types/sandbox';
import { SessionListItem } from './session-list-item';

interface RepoGroupProps {
  repoSlug: string;
  sessions: SandboxSession[];
  onArchiveOptimistic?: (sessionId: string) => void;
}

export function RepoGroup({ repoSlug, sessions, onArchiveOptimistic }: RepoGroupProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className='flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground'>
        <Folder className='h-4 w-4' />
        <span className='truncate'>{repoSlug}</span>
        <span className='ml-auto text-xs text-muted-foreground/70'>{sessions.length}</span>
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
