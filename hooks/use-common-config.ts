import { useQuery } from '@tanstack/react-query';

export interface CommonConfig {
  githubToken?: string;
  opencodeAuthJsonB64?: string;
  gistUrl?: string;
}

/**
 * Hook to fetch common configuration from environment variables
 */
export function useCommonConfig() {
  return useQuery<CommonConfig>({
    queryKey: ['common-config'],
    queryFn: async () => {
      const response = await fetch('/api/config');
      if (!response.ok) {
        throw new Error('Failed to fetch common config');
      }
      return response.json();
    },
    staleTime: Infinity, // Config doesn't change during session
    retry: false,
  });
}
