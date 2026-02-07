import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlanGeneration } from './use-plan-generation';

// Mock fetch
global.fetch = vi.fn();

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('usePlanGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully generate a plan', async () => {
    // Arrange
    const mockResponse = {
      plan: '# Implementation Plan\n\n1. Step one',
      sessionId: 'session-123',
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => usePlanGeneration(), {
      wrapper: createWrapper(),
    });

    // Act
    result.current.mutate({
      prompt: 'Implement user authentication',
    });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith('/api/plan/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'Implement user authentication',
      }),
    });
  });

  it('should include opencodeAuthJsonB64 when provided', async () => {
    // Arrange
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ plan: 'Test plan', sessionId: 'session-123' }),
    });

    const { result } = renderHook(() => usePlanGeneration(), {
      wrapper: createWrapper(),
    });

    // Act
    result.current.mutate({
      prompt: 'Test prompt',
      opencodeAuthJsonB64: 'base64-auth',
    });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(global.fetch).toHaveBeenCalledWith('/api/plan/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'Test prompt',
        opencodeAuthJsonB64: 'base64-auth',
      }),
    });
  });

  it('should handle error response with message field', async () => {
    // Arrange
    (global.fetch as any).mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Custom error message' }),
    });

    const { result } = renderHook(() => usePlanGeneration(), {
      wrapper: createWrapper(),
    });

    // Act
    result.current.mutate({
      prompt: 'Test prompt',
    });

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Custom error message');
  });

  it('should handle error response with error field', async () => {
    // Arrange
    (global.fetch as any).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Error field message' }),
    });

    const { result } = renderHook(() => usePlanGeneration(), {
      wrapper: createWrapper(),
    });

    // Act
    result.current.mutate({
      prompt: 'Test prompt',
    });

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Error field message');
  });

  it('should handle error response with default message', async () => {
    // Arrange
    (global.fetch as any).mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    const { result } = renderHook(() => usePlanGeneration(), {
      wrapper: createWrapper(),
    });

    // Act
    result.current.mutate({
      prompt: 'Test prompt',
    });

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Failed to generate plan');
  });

  it('should handle network errors', async () => {
    // Arrange
    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => usePlanGeneration(), {
      wrapper: createWrapper(),
    });

    // Act
    result.current.mutate({
      prompt: 'Test prompt',
    });

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Network error');
  });

  it('should set isPending to true during mutation', async () => {
    // Arrange
    let resolvePromise: (value: any) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    (global.fetch as any).mockReturnValue(promise);

    const { result } = renderHook(() => usePlanGeneration(), {
      wrapper: createWrapper(),
    });

    // Act
    result.current.mutate({
      prompt: 'Test prompt',
    });

    // Assert
    await waitFor(() => expect(result.current.isPending).toBe(true));

    // Cleanup
    resolvePromise!({
      ok: true,
      json: async () => ({ plan: 'Test', sessionId: '123' }),
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));
  });

  it('should call onSuccess callback when mutation succeeds', async () => {
    // Arrange
    const mockResponse = {
      plan: 'Test plan',
      sessionId: 'session-123',
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const onSuccess = vi.fn();
    const { result } = renderHook(() => usePlanGeneration(), {
      wrapper: createWrapper(),
    });

    // Act
    result.current.mutate({ prompt: 'Test prompt' }, { onSuccess });

    // Assert
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    // Check that onSuccess was called with the correct data and variables
    const successCallArgs = onSuccess.mock.calls[0];
    expect(successCallArgs[0]).toEqual(mockResponse);
    expect(successCallArgs[1]).toEqual({ prompt: 'Test prompt' });
  });

  it('should call onError callback when mutation fails', async () => {
    // Arrange
    (global.fetch as any).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Test error' }),
    });

    const onError = vi.fn();
    const { result } = renderHook(() => usePlanGeneration(), {
      wrapper: createWrapper(),
    });

    // Act
    result.current.mutate({ prompt: 'Test prompt' }, { onError });

    // Assert
    await waitFor(() => expect(onError).toHaveBeenCalled());
    // Check that onError was called with an Error and correct variables
    const errorCallArgs = onError.mock.calls[0];
    expect(errorCallArgs[0]).toBeInstanceOf(Error);
    expect(errorCallArgs[1]).toEqual({ prompt: 'Test prompt' });
  });
});
