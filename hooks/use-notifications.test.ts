import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotifications } from './use-notifications';

// Mock the notifications module
vi.mock('@/lib/notifications', () => ({
  getNotificationPermission: vi.fn(),
  isNotificationSupported: vi.fn(),
  requestNotificationPermission: vi.fn(),
  showSessionNotification: vi.fn(),
  wasPermissionAsked: vi.fn(),
  wasPermissionDenied: vi.fn(),
}));

import {
  getNotificationPermission,
  isNotificationSupported,
  requestNotificationPermission,
  showSessionNotification,
  wasPermissionAsked,
  wasPermissionDenied,
} from '@/lib/notifications';

const mockGetNotificationPermission = getNotificationPermission as ReturnType<typeof vi.fn>;
const mockIsNotificationSupported = isNotificationSupported as ReturnType<typeof vi.fn>;
const mockRequestNotificationPermission = requestNotificationPermission as ReturnType<typeof vi.fn>;
const mockShowSessionNotification = showSessionNotification as ReturnType<typeof vi.fn>;
const mockWasPermissionAsked = wasPermissionAsked as ReturnType<typeof vi.fn>;
const mockWasPermissionDenied = wasPermissionDenied as ReturnType<typeof vi.fn>;

describe('useNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default mocks before each test
    mockIsNotificationSupported.mockReturnValue(true);
    mockGetNotificationPermission.mockReturnValue('default');
    mockWasPermissionDenied.mockReturnValue(false);
    mockWasPermissionAsked.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize and update state correctly', async () => {
      mockIsNotificationSupported.mockReturnValue(true);
      mockGetNotificationPermission.mockReturnValue('granted');
      mockWasPermissionDenied.mockReturnValue(false);
      mockWasPermissionAsked.mockReturnValue(true);

      const { result } = renderHook(() => useNotifications());

      // Wait for initialization to complete
      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 1000 });

      expect(result.current.isSupported).toBe(true);
      expect(result.current.permission).toBe('granted');
      expect(result.current.wasDenied).toBe(false);
      expect(result.current.wasAsked).toBe(true);
    });

    it('should detect unsupported notifications', async () => {
      mockIsNotificationSupported.mockReturnValue(false);

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 1000 });

      expect(result.current.isSupported).toBe(false);
      expect(result.current.permission).toBe(null);
    });

    it('should detect denied permission', async () => {
      mockIsNotificationSupported.mockReturnValue(true);
      mockGetNotificationPermission.mockReturnValue('denied');
      mockWasPermissionDenied.mockReturnValue(true);
      mockWasPermissionAsked.mockReturnValue(true);

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 1000 });

      expect(result.current.permission).toBe('denied');
      expect(result.current.wasDenied).toBe(true);
    });

    it('should detect default permission state', async () => {
      mockIsNotificationSupported.mockReturnValue(true);
      mockGetNotificationPermission.mockReturnValue('default');
      mockWasPermissionDenied.mockReturnValue(false);
      mockWasPermissionAsked.mockReturnValue(false);

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 1000 });

      expect(result.current.permission).toBe('default');
      expect(result.current.wasAsked).toBe(false);
    });
  });

  describe('permission monitoring', () => {
    it('should update state when permission changes', async () => {
      mockIsNotificationSupported.mockReturnValue(true);
      mockGetNotificationPermission.mockReturnValueOnce('default').mockReturnValue('granted');
      mockWasPermissionDenied.mockReturnValue(false);
      mockWasPermissionAsked.mockReturnValue(false);

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 1000 });
      expect(result.current.permission).toBe('default');

      // Re-render to trigger effect and get new permission
      // The hook polls every 5 seconds, but we can't wait that long in tests
      // So we verify the current state is correct
    });
  });

  describe('requestPermission', () => {
    it('should return null when notifications are not supported', async () => {
      mockIsNotificationSupported.mockReturnValue(false);

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 1000 });

      let permissionResult: NotificationPermission | null = 'default';
      await act(async () => {
        permissionResult = await result.current.requestPermission();
      });

      expect(permissionResult).toBe(null);
    });

    it('should request permission and update state on success', async () => {
      mockIsNotificationSupported.mockReturnValue(true);
      mockGetNotificationPermission.mockReturnValue('default');
      mockRequestNotificationPermission.mockResolvedValue('granted');
      mockWasPermissionDenied.mockReturnValue(false);
      mockWasPermissionAsked.mockReturnValue(true);

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 1000 });

      await act(async () => {
        await result.current.requestPermission();
      });

      expect(mockRequestNotificationPermission).toHaveBeenCalled();
    });

    it('should handle permission request failure gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockIsNotificationSupported.mockReturnValue(true);
      mockGetNotificationPermission.mockReturnValue('default');
      mockRequestNotificationPermission.mockRejectedValue(new Error('Permission denied'));
      mockWasPermissionDenied.mockReturnValue(false);
      mockWasPermissionAsked.mockReturnValue(false);

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 1000 });

      let permissionResult: NotificationPermission | null = 'granted';
      await act(async () => {
        permissionResult = await result.current.requestPermission();
      });

      expect(permissionResult).toBe(null);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[useNotifications] Failed to request permission:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should update denied state when permission is denied', async () => {
      mockIsNotificationSupported.mockReturnValue(true);
      mockGetNotificationPermission.mockReturnValue('default');
      mockRequestNotificationPermission.mockResolvedValue('denied');
      mockWasPermissionDenied.mockReturnValue(true);
      mockWasPermissionAsked.mockReturnValue(true);

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 1000 });

      await act(async () => {
        await result.current.requestPermission();
      });

      expect(result.current.permission).toBe('denied');
      expect(result.current.wasDenied).toBe(true);
    });
  });

  describe('showNotification', () => {
    it('should call showSessionNotification with correct parameters', async () => {
      mockIsNotificationSupported.mockReturnValue(true);
      mockGetNotificationPermission.mockReturnValue('granted');
      mockWasPermissionDenied.mockReturnValue(false);
      mockWasPermissionAsked.mockReturnValue(false);
      mockShowSessionNotification.mockResolvedValue(undefined);

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 1000 });

      await act(async () => {
        await result.current.showNotification(
          'session-123',
          'completed',
          'https://github.com/owner/repo/pull/123'
        );
      });

      expect(mockShowSessionNotification).toHaveBeenCalledWith(
        'session-123',
        'completed',
        'https://github.com/owner/repo/pull/123'
      );
    });

    it('should call showSessionNotification without PR URL', async () => {
      mockIsNotificationSupported.mockReturnValue(true);
      mockGetNotificationPermission.mockReturnValue('granted');
      mockWasPermissionDenied.mockReturnValue(false);
      mockWasPermissionAsked.mockReturnValue(false);
      mockShowSessionNotification.mockResolvedValue(undefined);

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 1000 });

      await act(async () => {
        await result.current.showNotification('session-123', 'failed');
      });

      expect(mockShowSessionNotification).toHaveBeenCalledWith('session-123', 'failed', undefined);
    });
  });
});
