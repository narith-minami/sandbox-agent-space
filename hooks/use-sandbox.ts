'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SandboxConfig, CreateSandboxResponse, SandboxSessionWithLogs, ApiError } from '@/types/sandbox';

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
  return useQuery({
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
      // Stop refetching when session is completed or failed
      if (data?.status === 'completed' || data?.status === 'failed') {
        return false;
      }
      return 2000; // Refetch every 2 seconds while running
    },
  });
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
      if (data?.status === 'completed' || data?.status === 'failed') {
        return false;
      }
      return 1000;
    },
  });
}
