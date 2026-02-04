import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { SandboxConfigFormData } from '@/components/sandbox/config-form';
import { getLastUsedValues } from '@/lib/storage';
import type { SandboxSessionWithLogs } from '@/types/sandbox';

/**
 * useSessionCloning - Manages default form values from cloned session or localStorage
 *
 * Responsibilities:
 * - Load configuration from cloned session
 * - Load configuration from localStorage as fallback
 * - Show appropriate toast notifications
 * - Prevent duplicate initialization
 */
export function useSessionCloning(
  cloneSession: SandboxSessionWithLogs | undefined,
  isCloneLoading: boolean
): Partial<SandboxConfigFormData> | undefined {
  const [defaultValues, setDefaultValues] = useState<Partial<SandboxConfigFormData> | undefined>();
  const hasInitialized = useRef(false);

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
        memo: cloneSession.memo || '',
        opencodeAuthJsonB64: '', // Don't clone sensitive data
        runtime: config.runtime || 'node24',
        snapshotId: config.snapshotId || '',
        enableCodeReview: config.enableCodeReview ?? false,
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
        opencodeAuthJsonB64: '',
        gistUrl: '',
        runtime: 'node24',
        snapshotId: '',
        enableCodeReview: true,
      });
    }
  }, [cloneSession, isCloneLoading]);

  return defaultValues;
}
