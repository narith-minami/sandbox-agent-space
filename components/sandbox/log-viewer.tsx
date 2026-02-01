'use client';

import { useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { LogLevel } from '@/types/sandbox';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
}

interface LogViewerProps {
  logs: LogEntry[];
  autoScroll?: boolean;
  maxHeight?: string;
}

const levelColors: Record<LogLevel, string> = {
  info: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  error: 'bg-red-500/10 text-red-500 border-red-500/20',
  debug: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  stdout: 'bg-green-500/10 text-green-500 border-green-500/20',
  stderr: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
};

export function LogViewer({ logs, autoScroll = true, maxHeight = '500px' }: LogViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when logs array changes
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  if (logs.length === 0) {
    return (
      <div className='flex items-center justify-center h-40 text-muted-foreground border rounded-lg bg-muted/50'>
        No logs available
      </div>
    );
  }

  return (
    <ScrollArea
      className='border rounded-lg bg-black/95'
      style={{ height: maxHeight }}
      ref={scrollRef}
    >
      <div className='p-4 font-mono text-sm space-y-1'>
        {logs.map((log, index) => (
          <div
            key={`${log.timestamp}-${index}`}
            className='flex gap-2 items-start hover:bg-white/5 px-2 py-1 rounded'
          >
            <span className='text-muted-foreground shrink-0 text-xs'>
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
            <Badge
              variant='outline'
              className={`shrink-0 text-xs uppercase ${levelColors[log.level]}`}
            >
              {log.level}
            </Badge>
            <span
              className={`text-white/90 break-all ${log.level === 'error' || log.level === 'stderr' ? 'text-red-400' : ''}`}
            >
              {log.message}
            </span>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
