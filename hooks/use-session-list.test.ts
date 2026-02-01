import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useSessionList } from './use-session-list';
import { createWrapper, renderHook, waitFor } from '@/test/react-test-utils';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useSessionList', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('should fetch sessions with default params', async () => {
    const mockResponse = {
      sessions: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          sandboxId: 'sandbox-123',
          status: 'running',
          config: {},
          runtime: 'node24',
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const { result } = renderHook(() => useSessionList(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith('/api/sessions?page=1&limit=20');
  });

  it('should fetch with custom pagination', async () => {
    const mockResponse = {
      sessions: [],
      total: 0,
      page: 2,
      limit: 10,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const { result } = renderHook(() => useSessionList({ page: 2, limit: 10 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith('/api/sessions?page=2&limit=10');
  });

  it('should include status filter', async () => {
    const mockResponse = {
      sessions: [],
      total: 0,
      page: 1,
      limit: 20,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const { result } = renderHook(
      () => useSessionList({ filters: { status: ['running', 'completed'] } }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/sessions?page=1&limit=20&status=running%2Ccompleted'
    );
  });

  it('should include archived filter', async () => {
    const mockResponse = {
      sessions: [],
      total: 0,
      page: 1,
      limit: 20,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const { result } = renderHook(
      () => useSessionList({ filters: { archived: true } }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/sessions?page=1&limit=20&archived=true'
    );
  });

  it('should handle API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Failed to fetch' }),
    });

    const { result } = renderHook(() => useSessionList(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Failed to fetch');
  });
});
