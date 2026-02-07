import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
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
  source: 'sdk';
  debug: {
    sourceModule: string;
    connectedProviderIds: string[];
    providerModelCounts: Record<string, number>;
  };
}

export function useModelOptions(opencodeAuthJsonB64?: string) {
  const initialAuthRef = useRef(opencodeAuthJsonB64 || '');

  return useQuery<ModelOptionsResponse>({
    queryKey: ['opencode-model-options'],
    queryFn: async () => {
      const response = await fetch('/api/opencode/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opencodeAuthJsonB64: initialAuthRef.current }),
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
