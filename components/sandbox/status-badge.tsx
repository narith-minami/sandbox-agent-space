'use client';

import { Badge } from '@/components/ui/badge';
import type { SessionStatus } from '@/types/sandbox';
import { Loader2, CheckCircle2, XCircle, Clock, StopCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: SessionStatus;
  showIcon?: boolean;
}

const statusConfig: Record<SessionStatus, {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  icon: typeof Loader2;
}> = {
  pending: {
    label: 'Pending',
    variant: 'secondary',
    icon: Clock,
  },
  running: {
    label: 'Running',
    variant: 'default',
    icon: Loader2,
  },
  stopping: {
    label: 'Stopping',
    variant: 'secondary',
    icon: StopCircle,
  },
  completed: {
    label: 'Completed',
    variant: 'outline',
    icon: CheckCircle2,
  },
  failed: {
    label: 'Failed',
    variant: 'destructive',
    icon: XCircle,
  },
};

export function StatusBadge({ status, showIcon = true }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1">
      {showIcon && (
        <Icon 
          className={`h-3 w-3 ${status === 'running' ? 'animate-spin' : ''}`} 
        />
      )}
      {config.label}
    </Badge>
  );
}
