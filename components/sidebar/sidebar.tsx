'use client';

import { ChevronDown, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { SidebarFilters } from '@/hooks/use-sidebar-sessions';
import { useSidebarSessions } from '@/hooks/use-sidebar-sessions';
import { cn } from '@/lib/utils';
import { SessionList } from './session-list';
import { SidebarFiltersPanel } from './sidebar-filters';

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);
  const [filters, setFilters] = useState<SidebarFilters>({
    status: undefined,
    prStatus: undefined,
    showArchived: false,
  });
  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set());

  const { data, isLoading } = useSidebarSessions(filters);
  const allSessions = data?.sessions ?? [];

  // Filter out optimistically archived sessions
  const sessions = useMemo(
    () => allSessions.filter((session) => !archivedIds.has(session.id)),
    [allSessions, archivedIds]
  );

  const handleArchiveOptimistic = (sessionId: string) => {
    setArchivedIds((prev) => new Set([...prev, sessionId]));
  };

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r bg-background transition-[width] duration-200',
        isOpen ? 'w-72' : 'w-14'
      )}
    >
      <div className={cn('flex items-center gap-2 border-b', isOpen ? 'px-3 py-3' : 'px-2 py-3')}>
        {isOpen && <span className='text-sm font-semibold'>Sessions</span>}
        <Button
          variant='ghost'
          size='icon'
          className={cn('ml-auto h-7 w-7', !isOpen && 'mx-auto')}
          onClick={() => setIsOpen((prev) => !prev)}
          title={isOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {isOpen ? <ChevronLeft className='h-4 w-4' /> : <ChevronRight className='h-4 w-4' />}
        </Button>
      </div>

      {isOpen ? (
        <div className='flex min-h-0 flex-1 flex-col'>
          <Collapsible>
            <CollapsibleTrigger asChild>
              <button
                type='button'
                className='group flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-xs text-muted-foreground hover:bg-muted/40'
              >
                <span className='flex items-center gap-2'>
                  <Filter className='h-3.5 w-3.5' />
                  Filters
                </span>
                <ChevronDown className='h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180' />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarFiltersPanel filters={filters} onChange={setFilters} />
            </CollapsibleContent>
          </Collapsible>

          <div className='min-h-0 flex-1'>
            <SessionList
              sessions={sessions}
              isLoading={isLoading}
              onArchiveOptimistic={handleArchiveOptimistic}
            />
          </div>
        </div>
      ) : (
        <div className='min-h-0 flex-1'>
          <SessionList
            sessions={sessions}
            isLoading={isLoading}
            compact
            onArchiveOptimistic={handleArchiveOptimistic}
          />
        </div>
      )}
    </aside>
  );
}
