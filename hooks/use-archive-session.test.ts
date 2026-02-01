import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useArchiveSession } from './use-archive-session';
import { createWrapper, renderHook, waitFor } from '@/test/react-test-utils';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useArchiveSession', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('should archive session successfully', async () => {
    const mockSession = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      sandboxId: 'sandbox-123',
      status: 'completed',
      config: {},
      runtime: 'node24',
      archived: true,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockSession),
    });

    const { result } = renderHook(() => useArchiveSession(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ sessionId: '550e8400-e29b-41d4-a716-446655440000', archived: true });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockSession);
    expect(mockFetch).toHaveBeenCalledWith('/api/sessions/550e8400-e29b-41d4-a716-446655440000', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ archived: true }),
    });
  });

  it('should unarchive session successfully', async () => {
    const mockSession = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      sandboxId: 'sandbox-123',
      status: 'completed',
      config: {},
      runtime: 'node24',
      archived: false,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockSession),
    });

    const { result } = renderHook(() => useArchiveSession(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ sessionId: '550e8400-e29b-41d4-a716-446655440000', archived: false });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.archived).toBe(false);
  });

  it('should handle API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Session not found' }),
    });

    const { result } = renderHook(() => useArchiveSession(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ sessionId: 'invalid-id', archived: true });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Session not found');
  });
});
