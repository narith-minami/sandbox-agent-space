'use client';

import { useQuery } from '@tanstack/react-query';
import type { GitHubBranchResponse } from '@/app/api/github/repos/[owner]/[repo]/branches/route';

interface UseGitHubBranchesParams {
  owner: string;
  repo: string;
  enabled?: boolean;
}

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
 * Fetch GitHub branches for a specific repository using TanStack Query
 * Automatically handles caching, refetching, and error states
 */
export function useGitHubBranches({ owner, repo, enabled = true }: UseGitHubBranchesParams) {
  return useQuery({
    queryKey: ['github-branches', owner, repo],
    queryFn: async (): Promise<GitHubBranchResponse[]> => {
      const response = await fetch(`/api/github/repos/${owner}/${repo}/branches`);

      if (!response.ok) {
        const errorData: GitHubApiError = await response.json();

        // Handle 401 authentication error with redirect
        if (response.status === 401 && errorData.loginUrl) {
          const authError = new Error('Authentication required. Redirecting to login...');
          (authError as Error & { loginUrl?: string }).loginUrl = errorData.loginUrl;
          throw authError;
        }

        // Handle rate limiting
        if (response.status === 429) {
          const resetAt = errorData.details?.resetAt;
          const message = resetAt
            ? `Rate limit exceeded. Try again after ${new Date(resetAt).toLocaleString()}`
            : 'Rate limit exceeded. Please try again later';
          throw new Error(message);
        }

        throw new Error(errorData.error || 'Failed to fetch branches');
      }

      return response.json();
    },
    enabled: enabled && !!owner && !!repo,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    retry: (failureCount, error) => {
      // Don't retry on 401 (authentication required)
      if (error instanceof Error && 'loginUrl' in error) {
        return false;
      }
      // Don't retry on 429 (rate limit exceeded)
      if (error instanceof Error && error.message.includes('Rate limit exceeded')) {
        return false;
      }
      // Don't retry on 404 (repository not found)
      if (error instanceof Error && error.message.includes('not found')) {
        return false;
      }
      // Retry up to 2 times for other errors
      return failureCount < 2;
    },
  });
}
