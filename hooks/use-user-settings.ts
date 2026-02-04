'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiError, UserSettings, UserSettingsResponse } from '@/types/sandbox';

export function useUserSettings() {
  return useQuery({
    queryKey: ['user-settings'],
    queryFn: async (): Promise<UserSettingsResponse> => {
      const response = await fetch('/api/settings');
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error);
      }
      return response.json();
    },
  });
}

export function useUpdateUserSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      opencodeAuthJsonB64?: string;
      enableCodeReview: boolean;
    }): Promise<UserSettings> => {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error);
      }
      const result: UserSettingsResponse = await response.json();
      return result.settings as UserSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-settings'] });
    },
  });
}
