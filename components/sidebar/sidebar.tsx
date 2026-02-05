'use client';

import { ChevronDown, ChevronLeft, ChevronRight, Filter, Menu, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useResponsiveSidebar } from '@/hooks/use-responsive-sidebar';
import type { SidebarFilters } from '@/hooks/use-sidebar-sessions';
import { useSidebarSessions } from '@/hooks/use-sidebar-sessions';
import { cn } from '@/lib/utils';
import { SessionList } from './session-list';
import { SidebarFiltersPanel } from './sidebar-filters';

export function Sidebar() {
  const { isOpen, toggle, isDesktop } = useResponsiveSidebar({ breakpoint: 'lg' });
  const [mobileOpen, setMobileOpen] = useState(false);
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

  const toggleMobile = useCallback(() => {
    setMobileOpen((prev) => !prev);
  }, []);

  const closeMobile = useCallback(() => {
    setMobileOpen(false);
  }, []);

  // Mobile: overlay sidebar
  if (!isDesktop) {
    return (
      <>
        {/* Backdrop */}
        {mobileOpen && (
          <button
            type='button'
            tabIndex={-1}
            aria-label='Close sidebar'
            className='fixed inset-0 z-40 bg-black/50 cursor-default'
            onClick={closeMobile}
          />
        )}
        {/* Mobile toggle button in header area */}
        <div className='fixed top-2 left-2 z-50 lg:hidden'>
          <Button
            variant='ghost'
            size='icon'
            className='h-9 w-9 bg-background/80 backdrop-blur shadow-sm border'
            onClick={toggleMobile}
            title={mobileOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            {mobileOpen ? <X className='h-5 w-5' /> : <Menu className='h-5 w-5' />}
          </Button>
        </div>
        {/* Slide-in sidebar */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-40 w-72 flex flex-col border-r bg-background transition-transform duration-200',
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className='flex items-center gap-2 px-3 py-3 border-b mt-12'>
            <span className='text-sm font-semibold'>Sessions</span>
            <Button
              variant='ghost'
              size='icon'
              className='ml-auto h-7 w-7'
              onClick={closeMobile}
              title='Close sidebar'
            >
              <X className='h-4 w-4' />
            </Button>
          </div>

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
        </aside>
      </>
    );
  }

  // Desktop: standard collapsible sidebar
  return (
    <aside
      className={cn(
        'hidden lg:flex h-full flex-col border-r bg-background transition-[width] duration-200',
        isOpen ? 'w-72' : 'w-14'
      )}
    >
      <div className={cn('flex items-center gap-2 border-b', isOpen ? 'px-3 py-3' : 'px-2 py-3')}>
        {isOpen && <span className='text-sm font-semibold'>Sessions</span>}
        <Button
          variant='ghost'
          size='icon'
          className={cn('ml-auto h-7 w-7', !isOpen && 'mx-auto')}
          onClick={toggle}
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
