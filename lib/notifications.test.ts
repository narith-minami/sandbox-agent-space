import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getNotificationPermission,
  isNotificationSupported,
  markPermissionAsked,
  markPermissionDenied,
  requestNotificationPermission,
  showSessionNotification,
  wasPermissionAsked,
  wasPermissionDenied,
} from './notifications';

function createMockNotification(
  permission: NotificationPermission,
  requestPermission?: () => Promise<NotificationPermission>
): typeof Notification {
  const MockNotification = function MockNotification() {} as unknown as typeof Notification;
  Object.defineProperty(MockNotification, 'permission', { value: permission });
  if (requestPermission) {
    Object.defineProperty(MockNotification, 'requestPermission', { value: requestPermission });
  }
  return MockNotification;
}

describe('isNotificationSupported', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('should return false when window is undefined (server-side)', () => {
    vi.stubGlobal('window', undefined);
    expect(isNotificationSupported()).toBe(false);
  });

  it('should return false when Notification API is not available', () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('navigator', { serviceWorker: {} });
    expect(isNotificationSupported()).toBe(false);
  });

  it('should return false when serviceWorker is not available', () => {
    vi.stubGlobal('window', { Notification: {} });
    vi.stubGlobal('navigator', {});
    expect(isNotificationSupported()).toBe(false);
  });

  it('should return true when both Notification and serviceWorker are available', () => {
    vi.stubGlobal('window', { Notification: {} });
    vi.stubGlobal('navigator', { serviceWorker: {} });
    expect(isNotificationSupported()).toBe(true);
  });
});

describe('getNotificationPermission', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('should return null when notifications are not supported', () => {
    vi.stubGlobal('window', undefined);
    expect(getNotificationPermission()).toBe(null);
  });

  it('should return current permission when supported', () => {
    // Define Notification class on globalThis to make it accessible
    const MockNotification = createMockNotification('granted');
    vi.stubGlobal('Notification', MockNotification);
    vi.stubGlobal('window', {
      Notification: MockNotification,
    });
    vi.stubGlobal('navigator', { serviceWorker: {} });
    expect(getNotificationPermission()).toBe('granted');
  });

  it('should return denied permission', () => {
    const MockNotification = createMockNotification('denied');
    vi.stubGlobal('Notification', MockNotification);
    vi.stubGlobal('window', {
      Notification: MockNotification,
    });
    vi.stubGlobal('navigator', { serviceWorker: {} });
    expect(getNotificationPermission()).toBe('denied');
  });
});

describe('localStorage permission tracking', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('wasPermissionDenied', () => {
    it('should return false when not denied', () => {
      expect(wasPermissionDenied()).toBe(false);
    });

    it('should return true when permission was denied', () => {
      localStorage.setItem('notification-permission-denied', 'true');
      expect(wasPermissionDenied()).toBe(true);
    });
  });

  describe('wasPermissionAsked', () => {
    it('should return false when not asked', () => {
      expect(wasPermissionAsked()).toBe(false);
    });

    it('should return true when permission was asked', () => {
      localStorage.setItem('notification-permission-asked', 'true');
      expect(wasPermissionAsked()).toBe(true);
    });
  });

  describe('markPermissionDenied', () => {
    it('should mark permission as denied in localStorage', () => {
      markPermissionDenied();
      expect(localStorage.getItem('notification-permission-denied')).toBe('true');
      expect(localStorage.getItem('notification-permission-asked')).toBe('true');
    });
  });

  describe('markPermissionAsked', () => {
    it('should mark permission as asked in localStorage', () => {
      markPermissionAsked();
      expect(localStorage.getItem('notification-permission-asked')).toBe('true');
    });
  });
});

describe('requestNotificationPermission', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('should throw error when notifications are not supported', async () => {
    vi.stubGlobal('window', undefined);
    await expect(requestNotificationPermission()).rejects.toThrow(
      'Notifications are not supported in this browser'
    );
  });

  it('should request permission and return granted', async () => {
    const mockRequestPermission = vi.fn().mockResolvedValue('granted');
    const MockNotification = createMockNotification('default', mockRequestPermission);
    vi.stubGlobal('Notification', MockNotification);
    vi.stubGlobal('window', {
      Notification: MockNotification,
    });
    vi.stubGlobal('navigator', { serviceWorker: {} });

    const result = await requestNotificationPermission();

    expect(result).toBe('granted');
    expect(mockRequestPermission).toHaveBeenCalled();
    expect(localStorage.getItem('notification-permission-asked')).toBe('true');
  });

  it('should request permission and return denied', async () => {
    const mockRequestPermission = vi.fn().mockResolvedValue('denied');
    const MockNotification = createMockNotification('default', mockRequestPermission);
    vi.stubGlobal('Notification', MockNotification);
    vi.stubGlobal('window', {
      Notification: MockNotification,
    });
    vi.stubGlobal('navigator', { serviceWorker: {} });

    const result = await requestNotificationPermission();

    expect(result).toBe('denied');
    expect(mockRequestPermission).toHaveBeenCalled();
    expect(localStorage.getItem('notification-permission-denied')).toBe('true');
    expect(localStorage.getItem('notification-permission-asked')).toBe('true');
  });
});

describe('showSessionNotification', () => {
  const mockShowNotification = vi.fn();
  let mockRegistration: { showNotification: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    localStorage.clear();
    mockShowNotification.mockResolvedValue(undefined);
    mockRegistration = {
      showNotification: mockShowNotification,
    };
  });

  it('should not show notification for non-terminal statuses', async () => {
    const MockNotification = createMockNotification('granted');
    vi.stubGlobal('Notification', MockNotification);
    vi.stubGlobal('window', {
      Notification: MockNotification,
    });
    vi.stubGlobal('navigator', {
      serviceWorker: {
        ready: Promise.resolve(mockRegistration),
      },
    });

    await showSessionNotification('session-123', 'running');
    await showSessionNotification('session-123', 'pending');

    expect(mockShowNotification).not.toHaveBeenCalled();
  });

  it('should show notification for completed status', async () => {
    const MockNotification = createMockNotification('granted');
    vi.stubGlobal('Notification', MockNotification);
    vi.stubGlobal('window', {
      Notification: MockNotification,
    });
    vi.stubGlobal('navigator', {
      serviceWorker: {
        ready: Promise.resolve(mockRegistration),
      },
    });

    await showSessionNotification('550e8400-e29b-41d4-a716-446655440000', 'completed');

    expect(mockShowNotification).toHaveBeenCalledWith('Session Completed', {
      body: '✅ Session 550e8400 completed successfully',
      tag: 'session-550e8400-e29b-41d4-a716-446655440000',
      requireInteraction: false,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        prUrl: undefined,
        status: 'completed',
      },
    });
  });

  it('should show notification for failed status', async () => {
    const MockNotification = createMockNotification('granted');
    vi.stubGlobal('Notification', MockNotification);
    vi.stubGlobal('window', {
      Notification: MockNotification,
    });
    vi.stubGlobal('navigator', {
      serviceWorker: {
        ready: Promise.resolve(mockRegistration),
      },
    });

    await showSessionNotification('550e8400-e29b-41d4-a716-446655440000', 'failed');

    expect(mockShowNotification).toHaveBeenCalledWith('Session Failed', {
      body: '❌ Session 550e8400 failed',
      tag: 'session-550e8400-e29b-41d4-a716-446655440000',
      requireInteraction: false,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        prUrl: undefined,
        status: 'failed',
      },
    });
  });

  it('should include PR info when PR URL is provided', async () => {
    const MockNotification = createMockNotification('granted');
    vi.stubGlobal('Notification', MockNotification);
    vi.stubGlobal('window', {
      Notification: MockNotification,
    });
    vi.stubGlobal('navigator', {
      serviceWorker: {
        ready: Promise.resolve(mockRegistration),
      },
    });

    const prUrl = 'https://github.com/owner/repo/pull/123';
    await showSessionNotification('550e8400-e29b-41d4-a716-446655440000', 'completed', prUrl);

    expect(mockShowNotification).toHaveBeenCalledWith(
      'Session Completed',
      expect.objectContaining({
        body: '✅ Session 550e8400 | PR: owner/repo#123',
      })
    );
  });

  it('should not show notification when permission is not granted', async () => {
    const MockNotification = createMockNotification('denied');
    vi.stubGlobal('Notification', MockNotification);
    vi.stubGlobal('window', {
      Notification: MockNotification,
    });
    vi.stubGlobal('navigator', {
      serviceWorker: {
        ready: Promise.resolve(mockRegistration),
      },
    });

    await showSessionNotification('session-123', 'completed');

    expect(mockShowNotification).not.toHaveBeenCalled();
  });

  it('should not show notification when not supported', async () => {
    vi.stubGlobal('window', undefined);

    await showSessionNotification('session-123', 'completed');

    expect(mockShowNotification).not.toHaveBeenCalled();
  });

  it('should handle service worker registration failure gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const MockNotification = createMockNotification('granted');
    vi.stubGlobal('Notification', MockNotification);
    vi.stubGlobal('window', {
      Notification: MockNotification,
    });
    vi.stubGlobal('navigator', {
      serviceWorker: {
        ready: Promise.reject(new Error('SW not ready')),
      },
    });

    // Suppress unhandled rejection
    const originalConsoleError = console.error;
    console.error = () => {};

    await showSessionNotification('session-123', 'completed');

    expect(mockShowNotification).not.toHaveBeenCalled();
    // Note: The console.error spy might not catch errors from rejected promises
    // due to async timing, so we just verify the notification wasn't shown

    console.error = originalConsoleError;
    consoleSpy.mockRestore();
  });

  it('should handle showNotification failure gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockShowNotification.mockRejectedValue(new Error('Notification failed'));

    const MockNotification = createMockNotification('granted');
    vi.stubGlobal('Notification', MockNotification);
    vi.stubGlobal('window', {
      Notification: MockNotification,
    });
    vi.stubGlobal('navigator', {
      serviceWorker: {
        ready: Promise.resolve(mockRegistration),
      },
    });

    await showSessionNotification('session-123', 'completed');

    // Wait for the async error handling
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockShowNotification).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
