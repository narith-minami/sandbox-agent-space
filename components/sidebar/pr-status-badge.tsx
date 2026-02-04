'use client';

import { GitMerge, GitPullRequest, GitPullRequestClosed } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PrStatus } from '@/types/sandbox';

interface PrStatusBadgeProps {
  status: PrStatus;
  compact?: boolean;
}

const prStatusConfig: Record<
  PrStatus,
  { label: string; className: string; icon: typeof GitPullRequest }
> = {
  open: {
    label: 'Open',
    className: 'text-emerald-500',
    icon: GitPullRequest,
  },
  closed: {
    label: 'Closed',
    className: 'text-rose-500',
    icon: GitPullRequestClosed,
  },
  merged: {
    label: 'Merged',
    className: 'text-violet-500',
    icon: GitMerge,
  },
};

export function PrStatusBadge({ status, compact = false }: PrStatusBadgeProps) {
  const config = prStatusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={cn('inline-flex items-center gap-1 text-xs font-medium', config.className)}
      title={config.label}
      role='img'
      aria-label={`PR ${config.label}`}
    >
      <Icon className='h-3.5 w-3.5' />
      {!compact && <span>{config.label}</span>}
    </span>
  );
}
