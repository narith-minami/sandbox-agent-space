import { useQuery } from '@tanstack/react-query';
import type { ModelConfig } from '@/lib/constants/models';

export interface ConnectedProvider {
  id: string;
  name: string;
  connected: boolean;
  isDefault: boolean;
}

export interface ModelOptionsResponse {
  providers: ConnectedProvider[];
  models: ModelConfig[];
  source: 'sdk' | 'fallback';
  debug: {
    sourceModule: string;
    connectedProviderIds: string[];
    providerModelCounts: Record<string, number>;
  };
}

export function useModelOptions(opencodeAuthJsonB64?: string) {
  return useQuery<ModelOptionsResponse>({
    queryKey: ['opencode-model-options', opencodeAuthJsonB64 || ''],
    queryFn: async () => {
      const response = await fetch('/api/opencode/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opencodeAuthJsonB64: opencodeAuthJsonB64 || '' }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch model options');
      }

      return response.json();
    },
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });
}
