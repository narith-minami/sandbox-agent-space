'use client';

import { Loader2 } from 'lucide-react';
import { LogViewer } from '@/components/sandbox/log-viewer';
import { StatusBadge } from '@/components/sandbox/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { StreamLogEntry } from '@/hooks/use-log-stream';
import type { SandboxSessionWithLogs } from '@/types/sandbox';

interface SessionStatusCardProps {
  sessionId: string;
  session: SandboxSessionWithLogs | undefined;
  isLoading: boolean;
  logs: StreamLogEntry[];
  isConnected: boolean;
  isComplete: boolean;
  streamError: string | null;
}

/**
 * SessionStatusCard - Displays session status and logs
 *
 * Shows:
 * - Session metadata (ID, Sandbox ID, Runtime)
 * - Stream connection status
 * - Live stream and all logs tabs
 */
export function SessionStatusCard({
  sessionId,
  session,
  isLoading,
  logs,
  isConnected,
  isComplete,
  streamError,
}: SessionStatusCardProps) {
  return (
    <Card className='border-0 shadow-none rounded-none md:border md:shadow-sm md:rounded-xl'>
      <CardHeader className='px-4 md:px-6'>
        <div className='flex items-center justify-between'>
          <CardTitle>Session</CardTitle>
          {session && <StatusBadge status={session.status} />}
          {isLoading && !session && <Loader2 className='h-4 w-4 animate-spin' />}
        </div>
      </CardHeader>
      <CardContent className='space-y-4 px-4 md:px-6'>
        <div className='text-sm space-y-2'>
          <div className='flex justify-between'>
            <span className='text-muted-foreground'>Session ID:</span>
            <span className='font-mono text-xs'>{sessionId}</span>
          </div>
          {session?.sandboxId && (
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Sandbox ID:</span>
              <span className='font-mono text-xs'>{session.sandboxId}</span>
            </div>
          )}
          {session?.runtime && (
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Runtime:</span>
              <span className='font-mono text-xs'>{session.runtime}</span>
            </div>
          )}
          <div className='flex justify-between'>
            <span className='text-muted-foreground'>Stream Status:</span>
            <span className={isConnected ? 'text-green-500' : 'text-yellow-500'}>
              {isConnected ? 'Connected' : isComplete ? 'Complete' : 'Disconnected'}
            </span>
          </div>
        </div>

        {streamError && (
          <div className='text-sm text-red-500 bg-red-500/10 p-2 rounded'>{streamError}</div>
        )}

        <Tabs defaultValue='stream' className='w-full'>
          <TabsList className='grid w-full grid-cols-2'>
            <TabsTrigger value='stream'>Live Stream</TabsTrigger>
            <TabsTrigger value='all'>All Logs</TabsTrigger>
          </TabsList>
          <TabsContent value='stream' className='mt-4'>
            <LogViewer
              logs={logs.map((log) => ({
                timestamp: log.timestamp,
                level: log.level,
                message: log.message,
              }))}
              maxHeight='400px'
            />
          </TabsContent>
          <TabsContent value='all' className='mt-4'>
            <LogViewer
              logs={
                session?.logs?.map((log) => ({
                  timestamp:
                    log.timestamp instanceof Date
                      ? log.timestamp.toISOString()
                      : String(log.timestamp),
                  level: log.level,
                  message: log.message,
                })) || []
              }
              maxHeight='400px'
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
