'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { showSessionNotification } from '@/lib/notifications';
import type {
  ApiError,
  CreateSandboxResponse,
  SandboxConfig,
  SandboxSessionWithLogs,
  SessionStatus,
} from '@/types/sandbox';

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Log message in development mode only
 */
function devLog(...args: unknown[]) {
  if (isDevelopment) {
    console.log(...args);
  }
}

// Create sandbox mutation
export function useSandboxCreate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: SandboxConfig): Promise<CreateSandboxResponse> => {
      const response = await fetch('/api/sandbox/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error);
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate sessions list
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

// Get session with logs
export function useSession(sessionId: string | null) {
  const prevStatusRef = useRef<SessionStatus | null>(null);
  const notificationShownRef = useRef<boolean>(false);
  const isFirstFetchRef = useRef<boolean>(true);

  const query = useQuery({
    queryKey: ['session', sessionId],
    queryFn: async (): Promise<SandboxSessionWithLogs> => {
      const response = await fetch(`/api/sandbox/${sessionId}`);

      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error);
      }

      return response.json();
    },
    enabled: !!sessionId,
    refetchInterval: (query) => {
      const data = query.state.data;
      const currentStatus = data?.status;
      const isTerminalStatus = currentStatus === 'completed' || currentStatus === 'failed';

      devLog('[useSession] Polling status:', {
        sessionId: data?.id.slice(0, 8),
        currentStatus,
        prevStatus: prevStatusRef.current,
        isFirstFetch: isFirstFetchRef.current,
        notificationShown: notificationShownRef.current,
        isTerminalStatus,
      });

      // Detect transition to terminal status and trigger notification
      // Trigger notification if:
      // 1. Current status is terminal (completed or failed)
      // 2. Notification has not been shown yet
      // 3. Either:
      //    a. This is NOT the first fetch (meaning we've seen a non-terminal status before)
      //    b. Previous status was explicitly running/pending (we tracked the transition)
      const hasTransitioned =
        !isFirstFetchRef.current ||
        (prevStatusRef.current !== null &&
          (prevStatusRef.current === 'running' || prevStatusRef.current === 'pending'));

      const shouldShowNotification =
        isTerminalStatus && !notificationShownRef.current && hasTransitioned;

      if (shouldShowNotification && data) {
        devLog(
          '[useSession] Status transition detected:',
          prevStatusRef.current,
          '→',
          currentStatus,
          '(firstFetch:',
          isFirstFetchRef.current,
          ')'
        );
        // Show browser notification
        showSessionNotification(data.id, currentStatus, data.prUrl)
          .then(() => {
            devLog('[useSession] Notification shown successfully');
            notificationShownRef.current = true;
          })
          .catch((error) => {
            console.error('[useSession] Failed to show notification:', error);
          });
      }

      // Update tracking refs
      if (currentStatus) {
        prevStatusRef.current = currentStatus;
      }

      // Mark that we've completed at least one fetch
      if (isFirstFetchRef.current) {
        isFirstFetchRef.current = false;
      }

      if (isTerminalStatus) return false;
      return 2000; // Refetch every 2 seconds while running
    },
  });

  // Reset refs when sessionId changes
  useEffect(() => {
    devLog('[useSession] Session changed, resetting refs:', sessionId);
    prevStatusRef.current = null;
    notificationShownRef.current = false;
    isFirstFetchRef.current = true;
  }, [sessionId]);

  return query;
}

// Get session status only
export function useSessionStatus(sessionId: string | null) {
  return useQuery({
    queryKey: ['session-status', sessionId],
    queryFn: async () => {
      const response = await fetch(`/api/sandbox/${sessionId}/status`);

      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error);
      }

      return response.json();
    },
    enabled: !!sessionId,
    refetchInterval: (query) => {
      const data = query.state.data;
      const isTerminalStatus = data?.status === 'completed' || data?.status === 'failed';
      if (isTerminalStatus) return false;
      return 1000;
    },
  });
}
