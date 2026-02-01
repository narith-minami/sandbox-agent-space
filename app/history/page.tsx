'use client';

import { Archive, ChevronLeft, ChevronRight, Inbox, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { SessionCard } from '@/components/sandbox/session-card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type SessionFilters, useSessionList } from '@/hooks/use-session-list';

type StatusFilter = 'all' | 'running' | 'failed' | 'completed';

const statusFilterMap: Record<Exclude<StatusFilter, 'all'>, 'running' | 'failed' | 'completed'> = {
  running: 'running',
  failed: 'failed',
  completed: 'completed',
};

export default function HistoryPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showArchived, setShowArchived] = useState(false);
  const limit = 12;

  // Build filters object
  const filters: SessionFilters = {
    archived: showArchived,
    status: statusFilter === 'all' ? undefined : [statusFilterMap[statusFilter]],
  };

  const { data, isLoading, error, refetch } = useSessionList({ page, limit, filters });

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  // Handle filter changes - reset to page 1
  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value as StatusFilter);
    setPage(1);
  };

  const handleArchiveToggle = (checked: boolean) => {
    setShowArchived(checked);
    setPage(1);
  };

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>History</h1>
          <p className='text-muted-foreground'>View past sandbox execution sessions</p>
        </div>
        <Button variant='outline' onClick={() => refetch()}>
          <RefreshCw className='mr-2 h-4 w-4' />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'>
        <Tabs
          value={statusFilter}
          onValueChange={handleStatusFilterChange}
          className='w-full sm:w-auto'
        >
          <TabsList>
            <TabsTrigger value='all'>All</TabsTrigger>
            <TabsTrigger value='running'>Running</TabsTrigger>
            <TabsTrigger value='failed'>Failed</TabsTrigger>
            <TabsTrigger value='completed'>Completed</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className='flex items-center space-x-2'>
          <Checkbox
            id='show-archived'
            checked={showArchived}
            onCheckedChange={handleArchiveToggle}
          />
          <Label htmlFor='show-archived' className='flex items-center gap-2 cursor-pointer'>
            <Archive className='h-4 w-4' />
            Show Archived
          </Label>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className='text-center py-12'>
          <p className='text-red-500 mb-4'>
            {error instanceof Error ? error.message : 'Failed to load sessions'}
          </p>
          <Button onClick={() => refetch()}>
            <RefreshCw className='mr-2 h-4 w-4' />
            Retry
          </Button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-6'>
          {Array.from({ length: 6 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder items are static
            <Skeleton key={i} className='h-48' />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && data?.sessions.length === 0 && (
        <div className='text-center py-12'>
          <Inbox className='mx-auto h-12 w-12 text-muted-foreground mb-4' />
          <h3 className='text-lg font-medium'>
            {showArchived ? 'No archived sessions' : 'No sessions found'}
          </h3>
          <p className='text-muted-foreground mt-2'>
            {statusFilter !== 'all'
              ? `No ${statusFilter} sessions ${showArchived ? 'in archive' : ''}. Try adjusting your filters.`
              : showArchived
                ? 'Archived sessions will appear here'
                : 'Start your first sandbox to see it here'}
          </p>
        </div>
      )}

      {/* Session Grid */}
      {!isLoading && !error && data && data.sessions.length > 0 && (
        <>
          <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-6'>
            {data.sessions.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className='flex items-center justify-center gap-2 pt-4'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className='h-4 w-4' />
                Previous
              </Button>
              <span className='text-sm text-muted-foreground px-4'>
                Page {page} of {totalPages}
              </span>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
                <ChevronRight className='h-4 w-4' />
              </Button>
            </div>
          )}

          {/* Total Count */}
          <p className='text-center text-sm text-muted-foreground'>Total: {data.total} sessions</p>
        </>
      )}
    </div>
  );
}
