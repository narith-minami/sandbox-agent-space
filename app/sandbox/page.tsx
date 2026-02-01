'use client';

import { Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ConfigForm, type SandboxConfigFormData } from '@/components/sandbox/config-form';
import { LogViewer } from '@/components/sandbox/log-viewer';
import { StatusBadge } from '@/components/sandbox/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCommonConfig } from '@/hooks/use-common-config';
import { useLogStream } from '@/hooks/use-log-stream';
import { useSandboxCreate, useSession } from '@/hooks/use-sandbox';
import { getLastUsedValues, saveLastUsedValues } from '@/lib/storage';
import type { SandboxConfig } from '@/types/sandbox';

function SandboxPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cloneFromSessionId = searchParams.get('clone');

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [defaultValues, setDefaultValues] = useState<Partial<SandboxConfigFormData> | undefined>();
  const hasInitialized = useRef(false);

  const createSandbox = useSandboxCreate();
  const { data: session, isLoading: isSessionLoading } = useSession(sessionId);
  const { data: cloneSession, isLoading: isCloneLoading } = useSession(cloneFromSessionId);
  const { data: commonConfig, isLoading: isCommonConfigLoading } = useCommonConfig();
  const { logs, isConnected, isComplete, error: streamError } = useLogStream(sessionId);

  // Load configuration from cloned session or localStorage
  useEffect(() => {
    if (hasInitialized.current) return;

    // Load from cloned session
    if (cloneSession) {
      hasInitialized.current = true;
      const config = cloneSession.config;
      setDefaultValues({
        planSource: config.planSource || 'file',
        planFile: config.planFile || '',
        planText: config.planText || '',
        gistUrl: config.gistUrl,
        repoUrl: config.repoUrl,
        repoSlug: config.repoSlug,
        baseBranch: config.baseBranch || 'main',
        frontDir: config.frontDir,
        githubToken: '', // Don't clone sensitive data
        opencodeAuthJsonB64: '', // Don't clone sensitive data
        runtime: config.runtime || 'node24',
        snapshotId: config.snapshotId || '',
        enableCodeReview: true, // Default to enabled
      });

      toast.info('Configuration loaded from previous session', {
        description: `Cloning from ${cloneSession.config.repoSlug}`,
      });
      return;
    }

    // Load from localStorage (only if not loading clone)
    if (!isCloneLoading) {
      hasInitialized.current = true;
      const lastUsed = getLastUsedValues();
      setDefaultValues({
        planSource: 'file',
        planFile: lastUsed.planFile || '',
        planText: '',
        repoUrl: lastUsed.repoUrl || '',
        repoSlug: lastUsed.repoSlug || '',
        baseBranch: lastUsed.baseBranch,
        frontDir: lastUsed.frontDir,
        githubToken: '',
        opencodeAuthJsonB64: '',
        gistUrl: '',
        runtime: 'node24',
        snapshotId: '',
        enableCodeReview: true,
      });
    }
  }, [cloneSession, isCloneLoading]);

  const handleSubmit = async (data: SandboxConfigFormData) => {
    try {
      // Save to localStorage for next time (only save planFile when using file mode)
      saveLastUsedValues({
        repoUrl: data.repoUrl,
        repoSlug: data.repoSlug,
        baseBranch: data.baseBranch,
        frontDir: data.frontDir,
        planFile: data.planSource === 'file' ? data.planFile : '',
      });

      // Convert form data to SandboxConfig
      const config: SandboxConfig = {
        planSource: data.planSource,
        planFile: data.planFile,
        planText: data.planText,
        gistUrl: data.gistUrl,
        repoUrl: data.repoUrl,
        repoSlug: data.repoSlug,
        baseBranch: data.baseBranch,
        frontDir: data.frontDir,
        githubToken: data.githubToken,
        opencodeAuthJsonB64: data.opencodeAuthJsonB64,
        runtime: data.runtime,
        snapshotId: data.snapshotId,
      };

      const result = await createSandbox.mutateAsync(config);
      setSessionId(result.sessionId);

      // Clear clone parameter from URL
      if (cloneFromSessionId) {
        router.replace('/sandbox');
      }

      toast.success('Sandbox started successfully!', {
        description: `Session ID: ${result.sessionId}`,
      });
    } catch (error) {
      toast.error('Failed to start sandbox', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold tracking-tight'>Sandbox</h1>
        <p className='text-muted-foreground'>
          {cloneFromSessionId
            ? 'Cloning configuration from previous session'
            : 'Configure and run a coding agent sandbox'}
        </p>
      </div>

      <div className='grid lg:grid-cols-2 gap-6'>
        {/* Configuration Form */}
        <div>
          {isCloneLoading || isCommonConfigLoading ? (
            <Card>
              <CardContent className='flex items-center justify-center h-[600px]'>
                <div className='text-center space-y-4'>
                  <Loader2 className='h-8 w-8 animate-spin mx-auto' />
                  <p className='text-muted-foreground'>Loading configuration...</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <ConfigForm
              onSubmit={handleSubmit}
              isLoading={createSandbox.isPending}
              defaultValues={defaultValues}
              commonConfig={commonConfig}
            />
          )}
        </div>

        {/* Session Status & Logs */}
        <div className='space-y-6'>
          {sessionId ? (
            <Card>
              <CardHeader>
                <div className='flex items-center justify-between'>
                  <CardTitle>Session</CardTitle>
                  {session && <StatusBadge status={session.status} />}
                  {isSessionLoading && !session && <Loader2 className='h-4 w-4 animate-spin' />}
                </div>
              </CardHeader>
              <CardContent className='space-y-4'>
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
                  <div className='text-sm text-red-500 bg-red-500/10 p-2 rounded'>
                    {streamError}
                  </div>
                )}

                <Tabs defaultValue='stream' className='w-full'>
                  <TabsList className='grid w-full grid-cols-2'>
                    <TabsTrigger value='stream'>Live Stream</TabsTrigger>
                    <TabsTrigger value='all'>All Logs</TabsTrigger>
                  </TabsList>
                  <TabsContent value='stream' className='mt-4'>
                    <LogViewer logs={logs} maxHeight='400px' />
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
          ) : (
            <Card>
              <CardContent className='flex items-center justify-center h-[400px] text-muted-foreground'>
                <div className='text-center space-y-2'>
                  <p>No active session</p>
                  <p className='text-sm'>
                    {cloneFromSessionId
                      ? 'Enter your credentials to clone and start the sandbox'
                      : 'Configure and start a sandbox to see logs'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SandboxPage() {
  return (
    <Suspense
      fallback={
        <div className='space-y-6'>
          <div>
            <h1 className='text-3xl font-bold tracking-tight'>Sandbox</h1>
            <p className='text-muted-foreground'>Loading...</p>
          </div>
          <Card>
            <CardContent className='flex items-center justify-center h-[600px]'>
              <Loader2 className='h-8 w-8 animate-spin' />
            </CardContent>
          </Card>
        </div>
      }
    >
      <SandboxPageContent />
    </Suspense>
  );
}
