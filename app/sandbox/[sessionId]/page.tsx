'use client';

import { use } from 'react';
import Link from 'next/link';
import { useSession } from '@/hooks/use-sandbox';
import { LogViewer } from '@/components/sandbox/log-viewer';
import { StatusBadge } from '@/components/sandbox/status-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, RefreshCw, Clock, GitBranch, FileText, ExternalLink, Copy, StickyNote } from 'lucide-react';

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default function SessionDetailPage({ params }: PageProps) {
  const { sessionId } = use(params);
  const { data: session, isLoading, error, refetch } = useSession(sessionId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid lg:grid-cols-3 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64 lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="space-y-6">
        <Link href="/history">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to History
          </Button>
        </Link>
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64 gap-4">
            <p className="text-muted-foreground">
              {error instanceof Error ? error.message : 'Session not found'}
            </p>
            <Button onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formattedDate = new Date(session.createdAt).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/history">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {session.config.repoSlug}
            </h1>
            <p className="text-sm text-muted-foreground font-mono">
              {sessionId}
            </p>
          </div>
        </div>
        <StatusBadge status={session.status} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Session Info */}
        <Card>
          <CardHeader>
            <CardTitle>Session Details</CardTitle>
            <CardDescription>Sandbox configuration and metadata</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Created:</span>
                <span>{formattedDate}</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <GitBranch className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Directory:</span>
                <span>{session.config.frontDir}</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Plan File:</span>
                <span>{session.config.planFile}</span>
              </div>
            </div>

            {session.memo && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <StickyNote className="h-4 w-4 text-muted-foreground" />
                    <h4 className="text-sm font-medium">Memo</h4>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {session.memo}
                  </p>
                </div>
              </>
            )}

            <Separator />

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Repository</h4>
              <a 
                href={session.config.repoUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                {session.config.repoUrl}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Gist URL</h4>
              <a 
                href={session.config.gistUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1 break-all"
              >
                {session.config.gistUrl.substring(0, 50)}...
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {session.prUrl && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Pull Request</h4>
                <a 
                  href={session.prUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1 break-all"
                >
                  {session.prUrl}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {session.sandboxId && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Sandbox ID</h4>
                  <p className="text-xs font-mono bg-muted px-2 py-1 rounded break-all">
                    {session.sandboxId}
                  </p>
                </div>
              </>
            )}

            <Separator />

            <Link href={`/sandbox?clone=${sessionId}`}>
              <Button className="w-full" variant="default">
                <Copy className="mr-2 h-4 w-4" />
                Clone This Session
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Logs */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Execution Logs</CardTitle>
            <CardDescription>
              {session.logs.length} log entries
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LogViewer 
              logs={session.logs.map(log => ({
                timestamp: log.timestamp instanceof Date 
                  ? log.timestamp.toISOString() 
                  : String(log.timestamp),
                level: log.level,
                message: log.message,
              }))} 
              maxHeight="500px"
              autoScroll={false}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
