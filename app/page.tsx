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
import { useEnvironmentPresets } from '@/hooks/use-environment-presets';
import { useLogStream } from '@/hooks/use-log-stream';
import { useNotifications } from '@/hooks/use-notifications';
import { useSandboxCreate, useSession } from '@/hooks/use-sandbox';
import { useSessionCloning } from '@/hooks/use-session-cloning';
import { useUserSettings } from '@/hooks/use-user-settings';
import { saveLastUsedValues } from '@/lib/storage';
import type { SandboxConfig, StreamLogEntry } from '@/types/sandbox';

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cloneFromSessionId = searchParams.get('clone');

  const [sessionId, setSessionId] = useState<string | null>(null);

  const createSandbox = useSandboxCreate();
  const { data: session, isLoading: isSessionLoading } = useSession(sessionId);
  const { data: cloneSession, isLoading: isCloneLoading } = useSession(cloneFromSessionId);
  const { data: commonConfig, isLoading: isCommonConfigLoading } = useCommonConfig();
  const { data: presetsData } = useEnvironmentPresets();
  const { data: userSettingsData, isLoading: isUserSettingsLoading } = useUserSettings();
  const { logs, isConnected, isComplete, error: streamError } = useLogStream(sessionId);
  const { permission, isSupported, requestPermission } = useNotifications();

  const defaultValues = useSessionCloning(cloneSession, isCloneLoading);

  const handleSubmit = async (data: SandboxConfigFormData) => {
    try {
      saveLastUsedValues({
        repoUrl: data.repoUrl,
        repoSlug: data.repoSlug,
        baseBranch: data.baseBranch,
        frontDir: data.frontDir,
        planFile: data.planSource === 'file' ? data.planFile : '',
      });

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
        enableCodeReview: data.enableCodeReview,
        modelProvider: data.modelProvider,
        modelId: data.modelId,
        memo: data.memo,
      };

      const result = await createSandbox.mutateAsync(config);
      setSessionId(result.sessionId);

      if (cloneFromSessionId) {
        router.replace('/');
      }

      toast.success('Sandbox started successfully!', {
        description: `Session ID: ${result.sessionId}`,
      });

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
    <div className='relative'>
      <div
        className='pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(120,113,108,0.18),transparent_55%)]'
        aria-hidden
      />
      <div className='space-y-6'>
        <div>
          {isCloneLoading || isCommonConfigLoading || isUserSettingsLoading ? (
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
              userSettings={userSettingsData?.settings || null}
              presets={presetsData?.presets || []}
            />
          )}
        </div>

        <div className='space-y-6'>
          {sessionId ? (
            <SessionStatusCard
              sessionId={sessionId}
              session={session}
              isLoading={isSessionLoading}
              logs={logs as unknown as StreamLogEntry[]}
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

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className='space-y-6'>
          <Card>
            <CardContent className='flex items-center justify-center h-[600px]'>
              <Loader2 className='h-8 w-8 animate-spin' />
            </CardContent>
          </Card>
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}
