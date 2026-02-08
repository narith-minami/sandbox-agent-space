'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiError, EnvironmentPreset, EnvironmentPresetListResponse } from '@/types/sandbox';

export function useEnvironmentPresets() {
  return useQuery({
    queryKey: ['environment-presets'],
    queryFn: async (): Promise<EnvironmentPresetListResponse> => {
      const response = await fetch('/api/presets');
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error);
      }
      return response.json();
    },
  });
}

export function useCreateEnvironmentPreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      gistUrl: string;
      snapshotId?: string;
      workdir: string;
      notes?: string;
    }): Promise<EnvironmentPreset> => {
      const response = await fetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['environment-presets'] });
    },
  });
}

export function useUpdateEnvironmentPreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      id: string;
      name: string;
      gistUrl: string;
      snapshotId?: string;
      workdir: string;
      notes?: string;
    }): Promise<EnvironmentPreset> => {
      const response = await fetch(`/api/presets/${data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          gistUrl: data.gistUrl,
          snapshotId: data.snapshotId,
          workdir: data.workdir,
          notes: data.notes,
        }),
      });
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['environment-presets'] });
    },
  });
}

export function useDeleteEnvironmentPreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const response = await fetch(`/api/presets/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['environment-presets'] });
    },
  });
}
