'use client';

import { useQuery } from '@tanstack/react-query';
import type { SessionListResponse, ApiError } from '@/types/sandbox';

interface UseSessionListOptions {
  page?: number;
  limit?: number;
}

export function useSessionList({ page = 1, limit = 20 }: UseSessionListOptions = {}) {
  return useQuery({
    queryKey: ['sessions', page, limit],
    queryFn: async (): Promise<SessionListResponse> => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      
      const response = await fetch(`/api/sessions?${params}`);
      
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error);
      }

      return response.json();
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}
