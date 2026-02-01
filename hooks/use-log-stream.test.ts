import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useLogStream } from './use-log-stream';

// Mock EventSource
class MockEventSource {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  url: string;
  readyState = 0;

  constructor(url: string) {
    this.url = url;
  }

  close() {
    this.readyState = 2;
  }

  // Helper to simulate events
  simulateOpen() {
    this.readyState = 1;
    this.onopen?.();
  }

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  simulateError() {
    this.onerror?.();
  }
}

describe('useLogStream', () => {
  let eventSourceInstances: MockEventSource[] = [];

  beforeEach(() => {
    eventSourceInstances = [];
    // @ts-expect-error - mocking EventSource
    global.EventSource = vi.fn().mockImplementation((url: string) => {
      const instance = new MockEventSource(url);
      eventSourceInstances.push(instance);
      return instance;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should connect to EventSource when sessionId is provided', () => {
    renderHook(() => useLogStream('session-123'));

    expect(EventSource).toHaveBeenCalledWith('/api/sandbox/session-123/logs');
    expect(eventSourceInstances).toHaveLength(1);
  });

  it('should not connect when sessionId is null', () => {
    renderHook(() => useLogStream(null));

    expect(EventSource).not.toHaveBeenCalled();
  });

  it('should set isConnected to true on open', async () => {
    const { result } = renderHook(() => useLogStream('session-123'));

    // Simulate connection open
    eventSourceInstances[0].simulateOpen();

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });
  });

  it('should add log entries on message', async () => {
    const { result } = renderHook(() => useLogStream('session-123'));

    eventSourceInstances[0].simulateOpen();

    eventSourceInstances[0].simulateMessage({
      type: 'log',
      timestamp: '2024-01-01T00:00:00Z',
      level: 'info',
      message: 'Test message',
    });

    await waitFor(() => {
      expect(result.current.logs).toHaveLength(1);
    });

    expect(result.current.logs[0]).toEqual({
      timestamp: '2024-01-01T00:00:00Z',
      level: 'info',
      message: 'Test message',
    });
  });

  it('should handle multiple log messages', async () => {
    const { result } = renderHook(() => useLogStream('session-123'));

    eventSourceInstances[0].simulateOpen();

    eventSourceInstances[0].simulateMessage({
      type: 'log',
      timestamp: '2024-01-01T00:00:00Z',
      level: 'info',
      message: 'First message',
    });

    eventSourceInstances[0].simulateMessage({
      type: 'log',
      timestamp: '2024-01-01T00:00:01Z',
      level: 'error',
      message: 'Second message',
    });

    await waitFor(() => {
      expect(result.current.logs).toHaveLength(2);
    });

    expect(result.current.logs[0].message).toBe('First message');
    expect(result.current.logs[1].message).toBe('Second message');
  });

  it('should set isComplete on complete message', async () => {
    const { result } = renderHook(() => useLogStream('session-123'));

    eventSourceInstances[0].simulateOpen();

    eventSourceInstances[0].simulateMessage({
      type: 'complete',
    });

    await waitFor(() => {
      expect(result.current.isComplete).toBe(true);
    });

    // EventSource should be closed
    expect(eventSourceInstances[0].readyState).toBe(2);
  });

  it('should set error on error message', async () => {
    const { result } = renderHook(() => useLogStream('session-123'));

    eventSourceInstances[0].simulateOpen();

    eventSourceInstances[0].simulateMessage({
      type: 'error',
      message: 'Something went wrong',
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Something went wrong');
    });

    // EventSource should be closed
    expect(eventSourceInstances[0].readyState).toBe(2);
  });

  it('should handle connection error', async () => {
    const { result } = renderHook(() => useLogStream('session-123'));

    eventSourceInstances[0].simulateOpen();

    // Simulate connection error
    eventSourceInstances[0].simulateError();

    await waitFor(() => {
      expect(result.current.isConnected).toBe(false);
      expect(result.current.error).toBe('Connection lost');
    });
  });

  it('should reset state when sessionId becomes null', async () => {
    const { result, rerender } = renderHook(
      ({ sessionId }) => useLogStream(sessionId),
      {
        initialProps: { sessionId: 'session-123' as string | null },
      }
    );

    eventSourceInstances[0].simulateOpen();
    eventSourceInstances[0].simulateMessage({
      type: 'log',
      timestamp: '2024-01-01T00:00:00Z',
      level: 'info',
      message: 'Test message',
    });

    await waitFor(() => {
      expect(result.current.logs).toHaveLength(1);
    });

    // Change sessionId to null
    rerender({ sessionId: null });

    await waitFor(() => {
      expect(result.current.logs).toHaveLength(0);
      expect(result.current.isConnected).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.isComplete).toBe(false);
    });
  });

  it('should handle connected message type', async () => {
    const { result } = renderHook(() => useLogStream('session-123'));

    eventSourceInstances[0].simulateMessage({
      type: 'connected',
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });
  });

  it('should ignore invalid JSON messages', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useLogStream('session-123'));

    eventSourceInstances[0].simulateOpen();

    // Simulate invalid JSON
    if (eventSourceInstances[0].onmessage) {
      eventSourceInstances[0].onmessage({ data: 'invalid json' });
    }

    // Should not throw, just log error
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    // Logs should remain empty
    expect(result.current.logs).toHaveLength(0);

    consoleSpy.mockRestore();
  });
});
