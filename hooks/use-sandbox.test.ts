import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWrapper, renderHook, waitFor } from '@/test/react-test-utils';
import { useSandboxCreate, useSession, useSessionStatus } from './use-sandbox';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock notifications module
vi.mock('@/lib/notifications', () => ({
  showSessionNotification: vi.fn().mockResolvedValue(undefined),
}));

import { showSessionNotification } from '@/lib/notifications';

const mockShowSessionNotification = showSessionNotification as ReturnType<typeof vi.fn>;

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
      planText: '',
      repoUrl: 'https://github.com/owner/repo',
      repoSlug: 'owner/repo',
      baseBranch: 'main',
      gistUrl: 'https://gist.githubusercontent.com/user/gistid/raw',
      frontDir: 'frontend',
      githubToken: 'ghp_xxxxxxxxxxxxxxxxxxxx',
      opencodeAuthJsonB64: 'eyJ0b2tlbiI6InRlc3QifQ==',
      runtime: 'node24' as const,
      enableCodeReview: false,
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
      planText: '',
      repoUrl: 'https://github.com/owner/repo',
      repoSlug: 'owner/repo',
      baseBranch: 'main',
      gistUrl: 'https://gist.githubusercontent.com/user/gistid/raw',
      frontDir: 'frontend',
      githubToken: 'ghp_xxxxxxxxxxxxxxxxxxxx',
      opencodeAuthJsonB64: 'eyJ0b2tlbiI6InRlc3QifQ==',
      enableCodeReview: false,
    };

    result.current.mutate(config);

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Invalid configuration');
  });
});

describe('useSession', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockShowSessionNotification.mockClear();
    vi.clearAllTimers();
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

  describe('notification on status transition', () => {
    it('should show notification when transitioning from running to completed', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';
      const runningSession = {
        id: sessionId,
        sandboxId: 'sandbox-123',
        status: 'running',
        config: { planSource: 'file', planFile: 'plan.md' },
        runtime: 'node24',
        logs: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        prUrl: 'https://github.com/owner/repo/pull/123',
      };

      const completedSession = {
        ...runningSession,
        status: 'completed',
      };

      // First call returns running
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(runningSession),
      });

      // Second call returns completed
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(completedSession),
      });

      const { result } = renderHook(() => useSession(sessionId), {
        wrapper: createWrapper(),
      });

      // Wait for first fetch (running)
      await waitFor(() => expect(result.current.data?.status).toBe('running'));

      // Wait for second fetch (completed) and notification
      await waitFor(() => expect(result.current.data?.status).toBe('completed'), {
        timeout: 3000,
      });

      // Notification should be called
      expect(mockShowSessionNotification).toHaveBeenCalledWith(
        sessionId,
        'completed',
        'https://github.com/owner/repo/pull/123'
      );
    });

    it('should show notification when transitioning from running to failed', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';
      const runningSession = {
        id: sessionId,
        sandboxId: 'sandbox-123',
        status: 'running',
        config: { planSource: 'file', planFile: 'plan.md' },
        runtime: 'node24',
        logs: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        prUrl: null,
      };

      const failedSession = {
        ...runningSession,
        status: 'failed',
      };

      // First call returns running
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(runningSession),
      });

      // Second call returns failed
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(failedSession),
      });

      const { result } = renderHook(() => useSession(sessionId), {
        wrapper: createWrapper(),
      });

      // Wait for first fetch (running)
      await waitFor(() => expect(result.current.data?.status).toBe('running'));

      // Wait for second fetch (failed) and notification
      await waitFor(() => expect(result.current.data?.status).toBe('failed'), {
        timeout: 3000,
      });

      // Notification should be called
      expect(mockShowSessionNotification).toHaveBeenCalledWith(sessionId, 'failed', null);
    });

    it('should show notification when transitioning from pending to completed', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';
      const pendingSession = {
        id: sessionId,
        sandboxId: 'sandbox-123',
        status: 'pending',
        config: { planSource: 'file', planFile: 'plan.md' },
        runtime: 'node24',
        logs: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        prUrl: null,
      };

      const completedSession = {
        ...pendingSession,
        status: 'completed',
      };

      // First call returns pending
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(pendingSession),
      });

      // Second call returns completed
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(completedSession),
      });

      const { result } = renderHook(() => useSession(sessionId), {
        wrapper: createWrapper(),
      });

      // Wait for first fetch (pending)
      await waitFor(() => expect(result.current.data?.status).toBe('pending'));

      // Wait for second fetch (completed) and notification
      await waitFor(() => expect(result.current.data?.status).toBe('completed'), {
        timeout: 3000,
      });

      // Notification should be called
      expect(mockShowSessionNotification).toHaveBeenCalledWith(sessionId, 'completed', null);
    });

    it('should NOT show notification for initial terminal status', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';
      const completedSession = {
        id: sessionId,
        sandboxId: 'sandbox-123',
        status: 'completed',
        config: { planSource: 'file', planFile: 'plan.md' },
        runtime: 'node24',
        logs: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        prUrl: null,
      };

      // Single call returns completed immediately
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(completedSession),
      });

      renderHook(() => useSession(sessionId), {
        wrapper: createWrapper(),
      });

      // Wait a bit
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Notification should NOT be called (no transition from running/pending)
      expect(mockShowSessionNotification).not.toHaveBeenCalled();
    });

    it('should NOT show duplicate notifications for same session', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';
      const runningSession = {
        id: sessionId,
        sandboxId: 'sandbox-123',
        status: 'running',
        config: { planSource: 'file', planFile: 'plan.md' },
        runtime: 'node24',
        logs: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        prUrl: null,
      };

      const completedSession = {
        ...runningSession,
        status: 'completed',
      };

      // First call returns running
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(runningSession),
      });

      // Multiple calls return completed (simulating multiple polls after completion)
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(completedSession),
      });

      const { result } = renderHook(() => useSession(sessionId), {
        wrapper: createWrapper(),
      });

      // Wait for first fetch (running)
      await waitFor(() => expect(result.current.data?.status).toBe('running'));

      // Wait for transition to completed
      await waitFor(() => expect(result.current.data?.status).toBe('completed'), {
        timeout: 3000,
      });

      // Wait for potential additional polls
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
      });

      // Notification should be called only once
      expect(mockShowSessionNotification).toHaveBeenCalledTimes(1);
    });

    it('should reset notification state when sessionId changes', async () => {
      const sessionId1 = '550e8400-e29b-41d4-a716-446655440000';
      const sessionId2 = '660f9511-f3ac-52e5-b827-557766551111';

      const runningSession1 = {
        id: sessionId1,
        sandboxId: 'sandbox-123',
        status: 'running',
        config: { planSource: 'file', planFile: 'plan.md' },
        runtime: 'node24',
        logs: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        prUrl: null,
      };

      const completedSession1 = {
        ...runningSession1,
        status: 'completed',
      };

      const runningSession2 = {
        id: sessionId2,
        sandboxId: 'sandbox-456',
        status: 'running',
        config: { planSource: 'file', planFile: 'plan.md' },
        runtime: 'node24',
        logs: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        prUrl: null,
      };

      const completedSession2 = {
        ...runningSession2,
        status: 'completed',
      };

      // First session: running -> completed
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(runningSession1),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(completedSession1),
      });

      // Second session: running -> completed
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(runningSession2),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(completedSession2),
      });

      const { result, rerender } = renderHook(({ id }) => useSession(id), {
        wrapper: createWrapper(),
        initialProps: { id: sessionId1 },
      });

      // Wait for first session completion
      await waitFor(() => expect(result.current.data?.status).toBe('completed'), {
        timeout: 3000,
      });

      // Notification should be called once for first session
      expect(mockShowSessionNotification).toHaveBeenCalledTimes(1);
      expect(mockShowSessionNotification).toHaveBeenCalledWith(sessionId1, 'completed', null);

      // Change to second session
      rerender({ id: sessionId2 });

      // Wait for second session running
      await waitFor(() => expect(result.current.data?.status).toBe('running'), {
        timeout: 3000,
      });

      // Wait for second session completion
      await waitFor(() => expect(result.current.data?.status).toBe('completed'), {
        timeout: 3000,
      });

      // Notification should be called again for second session (2 total)
      expect(mockShowSessionNotification).toHaveBeenCalledTimes(2);
      expect(mockShowSessionNotification).toHaveBeenLastCalledWith(sessionId2, 'completed', null);
    });
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
