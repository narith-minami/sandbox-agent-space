'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SidebarFilters } from '@/hooks/use-sidebar-sessions';
import type { PrStatus, SessionStatus } from '@/types/sandbox';

interface SidebarFiltersProps {
  filters: SidebarFilters;
  onChange: (filters: SidebarFilters) => void;
}

const sessionStatusOptions: Array<{ value: SessionStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'running', label: 'Running' },
  { value: 'stopping', label: 'Stopping' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

const prStatusOptions: Array<{ value: PrStatus | 'all'; label: string }> = [
  { value: 'all', label: 'すべて' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'merged', label: 'Merged' },
];

export function SidebarFiltersPanel({ filters, onChange }: SidebarFiltersProps) {
  const statusValue = filters.status?.[0] ?? 'all';
  const prStatusValue = filters.prStatus?.[0] ?? 'all';

  return (
    <div className='space-y-4 px-3 py-2'>
      <div className='grid grid-cols-2 gap-3'>
        <div className='space-y-2'>
          <Label className='text-xs text-muted-foreground'>Session Status</Label>
          <Select
            value={statusValue}
            onValueChange={(value) =>
              onChange({
                ...filters,
                status: value === 'all' ? undefined : [value as SessionStatus],
              })
            }
          >
            <SelectTrigger className='h-8 text-xs'>
              <SelectValue placeholder='All' />
            </SelectTrigger>
            <SelectContent>
              {sessionStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='space-y-2'>
          <Label className='text-xs text-muted-foreground'>PR Status</Label>
          <Select
            value={prStatusValue}
            onValueChange={(value) =>
              onChange({
                ...filters,
                prStatus: value === 'all' ? undefined : [value as PrStatus],
              })
            }
          >
            <SelectTrigger className='h-8 text-xs'>
              <SelectValue placeholder='All' />
            </SelectTrigger>
            <SelectContent>
              {prStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className='flex items-center gap-2'>
        <Checkbox
          id='sidebar-archived'
          checked={filters.showArchived}
          onCheckedChange={(checked) =>
            onChange({
              ...filters,
              showArchived: checked === true,
            })
          }
        />
        <Label htmlFor='sidebar-archived' className='text-xs text-muted-foreground'>
          Show Archived
        </Label>
      </div>
    </div>
  );
}
