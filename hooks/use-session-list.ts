'use client';

import { useQuery } from '@tanstack/react-query';
import type { ApiError, SessionListResponse } from '@/types/sandbox';

export interface SessionFilters {
  status?: ('running' | 'failed' | 'completed')[];
  archived?: boolean;
}

interface UseSessionListOptions {
  page?: number;
  limit?: number;
  filters?: SessionFilters;
}

export function useSessionList({ page = 1, limit = 20, filters }: UseSessionListOptions = {}) {
  return useQuery({
    queryKey: ['sessions', page, limit, filters],
    queryFn: async (): Promise<SessionListResponse> => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      // Add status filter if provided
      if (filters?.status && filters.status.length > 0) {
        params.append('status', filters.status.join(','));
      }

      // Add archived filter if provided
      if (filters?.archived !== undefined) {
        params.append('archived', filters.archived.toString());
      }

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
