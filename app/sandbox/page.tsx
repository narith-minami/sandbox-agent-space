'use client';

import { Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { toast } from 'sonner';
import { ConfigForm, type SandboxConfigFormData } from '@/components/sandbox/config-form';
import { EmptySessionState } from '@/components/sandbox/empty-session-state';
import { SessionStatusCard } from '@/components/sandbox/session-status-card';
import { Card, CardContent } from '@/components/ui/card';
import { useCommonConfig } from '@/hooks/use-common-config';
import { useLogStream } from '@/hooks/use-log-stream';
import { useNotifications } from '@/hooks/use-notifications';
import { useSandboxCreate, useSession } from '@/hooks/use-sandbox';
import { useSessionCloning } from '@/hooks/use-session-cloning';
import { saveLastUsedValues } from '@/lib/storage';
import type { SandboxConfig } from '@/types/sandbox';

function SandboxPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cloneFromSessionId = searchParams.get('clone');

  const [sessionId, setSessionId] = useState<string | null>(null);

  const createSandbox = useSandboxCreate();
  const { data: session, isLoading: isSessionLoading } = useSession(sessionId);
  const { data: cloneSession, isLoading: isCloneLoading } = useSession(cloneFromSessionId);
  const { data: commonConfig, isLoading: isCommonConfigLoading } = useCommonConfig();
  const { logs, isConnected, isComplete, error: streamError } = useLogStream(sessionId);
  const { permission, isSupported, requestPermission } = useNotifications();

  // Load default values from clone session or localStorage
  const defaultValues = useSessionCloning(cloneSession, isCloneLoading);

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

      // Request notification permission if supported and not already granted/denied
      if (isSupported && permission === 'default') {
        try {
          await requestPermission();
        } catch (error) {
          console.error('Failed to request notification permission:', error);
        }
      }
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
            <SessionStatusCard
              sessionId={sessionId}
              session={session}
              isLoading={isSessionLoading}
              logs={logs as any}
              isConnected={isConnected}
              isComplete={isComplete}
              streamError={streamError}
            />
          ) : (
            <EmptySessionState isCloning={!!cloneFromSessionId} />
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
