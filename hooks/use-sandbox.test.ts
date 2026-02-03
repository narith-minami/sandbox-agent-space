import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWrapper, renderHook, waitFor } from '@/test/react-test-utils';
import { useSandboxCreate, useSession, useSessionStatus } from './use-sandbox';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useSandboxCreate', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('should create sandbox successfully', async () => {
    const mockResponse = {
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      sandboxId: 'sandbox-123',
      runtime: 'node24',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const { result } = renderHook(() => useSandboxCreate(), {
      wrapper: createWrapper(),
    });

    // Call the mutation
    const config = {
      planSource: 'file' as const,
      planFile: 'plan.md',
      runtime: 'node24' as const,
    };

    result.current.mutate(config);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith('/api/sandbox/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
  });

  it('should handle API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Invalid configuration' }),
    });

    const { result } = renderHook(() => useSandboxCreate(), {
      wrapper: createWrapper(),
    });

    const config = {
      planSource: 'file' as const,
      planFile: 'plan.md',
    };

    result.current.mutate(config);

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Invalid configuration');
  });
});

describe('useSession', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('should fetch session data', async () => {
    const mockSession = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      sandboxId: 'sandbox-123',
      status: 'running',
      config: { planSource: 'file', planFile: 'plan.md' },
      runtime: 'node24',
      logs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockSession),
    });

    const { result } = renderHook(() => useSession('550e8400-e29b-41d4-a716-446655440000'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockSession);
    expect(mockFetch).toHaveBeenCalledWith('/api/sandbox/550e8400-e29b-41d4-a716-446655440000');
  });

  it('should not fetch when sessionId is null', () => {
    const { result } = renderHook(() => useSession(null), {
      wrapper: createWrapper(),
    });

    expect(result.current.isPending).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should handle fetch error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Session not found' }),
    });

    const { result } = renderHook(() => useSession('invalid-id'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Session not found');
  });
});

describe('useSessionStatus', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('should fetch session status', async () => {
    const mockStatus = {
      status: 'running',
      vercelStatus: 'running',
      timeout: 600000,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockStatus),
    });

    const { result } = renderHook(() => useSessionStatus('550e8400-e29b-41d4-a716-446655440000'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockStatus);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/sandbox/550e8400-e29b-41d4-a716-446655440000/status'
    );
  });

  it('should not fetch when sessionId is null', () => {
    const { result } = renderHook(() => useSessionStatus(null), {
      wrapper: createWrapper(),
    });

    expect(result.current.isPending).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
