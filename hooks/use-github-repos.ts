'use client';

import { useQuery } from '@tanstack/react-query';
import type { GitHubRepoResponse } from '@/app/api/github/repos/route';

interface GitHubApiError {
  error: string;
  code?: string;
  details?: {
    message?: string;
    retryAfter?: string;
    resetAt?: string;
  };
  loginUrl?: string;
}

/**
 * Fetch GitHub repositories using TanStack Query
 * Automatically handles caching, refetching, and error states
 */
export function useGitHubRepos() {
  return useQuery({
    queryKey: ['github-repos'],
    queryFn: async (): Promise<GitHubRepoResponse[]> => {
      const response = await fetch('/api/github/repos');

      if (!response.ok) {
        const errorData: GitHubApiError = await response.json();

        // Handle 401 authentication error with redirect
        if (response.status === 401 && errorData.loginUrl) {
          window.location.href = errorData.loginUrl;
          throw new Error('Authentication required. Redirecting to login...');
        }

        // Handle rate limiting
        if (response.status === 429) {
          const resetAt = errorData.details?.resetAt;
          const message = resetAt
            ? `Rate limit exceeded. Try again after ${new Date(resetAt).toLocaleString()}`
            : 'Rate limit exceeded. Please try again later';
          throw new Error(message);
        }

        throw new Error(errorData.error || 'Failed to fetch repositories');
      }

      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    retry: (failureCount, error) => {
      // Don't retry on 401 (authentication required)
      if (error instanceof Error && error.message.includes('Authentication required')) {
        return false;
      }
      // Don't retry on 429 (rate limit exceeded)
      if (error instanceof Error && error.message.includes('Rate limit exceeded')) {
        return false;
      }
      // Retry up to 2 times for other errors
      return failureCount < 2;
    },
  });
}
