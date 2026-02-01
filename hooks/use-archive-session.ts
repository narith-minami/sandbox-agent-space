'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiError, SandboxSession } from '@/types/sandbox';

interface ArchiveSessionVariables {
  sessionId: string;
  archived: boolean;
}

export function useArchiveSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      archived,
    }: ArchiveSessionVariables): Promise<SandboxSession> => {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ archived }),
      });

      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error);
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate the sessions list query to refetch
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}
