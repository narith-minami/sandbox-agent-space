'use client';

import { useQuery } from '@tanstack/react-query';
import type { ApiError, PrStatus, SessionListResponse, SessionStatus } from '@/types/sandbox';

export interface SidebarFilters {
  status?: SessionStatus[];
  prStatus?: PrStatus[];
  showArchived: boolean;
}

const SIDEBAR_PAGE_LIMIT = 50;

export function useSidebarSessions(filters: SidebarFilters) {
  return useQuery({
    queryKey: ['sidebar-sessions', filters],
    queryFn: async (): Promise<SessionListResponse> => {
      const params = new URLSearchParams({
        page: '1',
        limit: SIDEBAR_PAGE_LIMIT.toString(),
        archived: filters.showArchived.toString(),
      });

      if (filters.status && filters.status.length > 0) {
        params.append('status', filters.status.join(','));
      }

      if (filters.prStatus && filters.prStatus.length > 0) {
        params.append('prStatus', filters.prStatus.join(','));
      }

      const response = await fetch(`/api/sessions?${params}`);
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error);
      }

      const data = (await response.json()) as SessionListResponse;
      const sessionsToRefresh = data.sessions.filter((session) => session.prUrl);
      const applyPrStatusFilter = (sessions: SessionListResponse['sessions']) =>
        filters.prStatus && filters.prStatus.length > 0
          ? sessions.filter(
              (session) => session.prStatus && filters.prStatus?.includes(session.prStatus)
            )
          : sessions;

      if (sessionsToRefresh.length === 0) {
        const filteredSessions = applyPrStatusFilter(data.sessions);
        return { ...data, sessions: filteredSessions, total: filteredSessions.length };
      }

      const prResponse = await fetch('/api/github/pr-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessions: sessionsToRefresh.map((session) => ({
            id: session.id,
            prUrl: session.prUrl,
          })),
        }),
      });

      if (!prResponse.ok) {
        const filteredSessions = applyPrStatusFilter(data.sessions);
        return { ...data, sessions: filteredSessions, total: filteredSessions.length };
      }

      const prData = (await prResponse.json()) as {
        results: Array<{ id: string; prStatus: PrStatus | null }>;
      };

      const statusMap = new Map(prData.results.map((result) => [result.id, result.prStatus]));

      const refreshedSessions = data.sessions.map((session) =>
        statusMap.has(session.id)
          ? { ...session, prStatus: statusMap.get(session.id) ?? null }
          : session
      );

      const filteredSessions = applyPrStatusFilter(refreshedSessions);

      return {
        ...data,
        sessions: filteredSessions,
        total: filteredSessions.length,
      };
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });
}
