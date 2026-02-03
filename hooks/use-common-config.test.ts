import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWrapper, renderHook, waitFor } from '@/test/react-test-utils';
import { useCommonConfig } from './use-common-config';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useCommonConfig', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('should fetch common config', async () => {
    const mockConfig = {
      githubToken: 'ghp_xxxxxxxx',
      opencodeAuthJsonB64: 'base64encoded',
      gistUrl: 'https://gist.github.com/...',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockConfig),
    });

    const { result } = renderHook(() => useCommonConfig(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockConfig);
    expect(mockFetch).toHaveBeenCalledWith('/api/config');
  });

  it('should handle API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
    });

    const { result } = renderHook(() => useCommonConfig(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Failed to fetch common config');
  });
});
