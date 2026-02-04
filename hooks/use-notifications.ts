'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getNotificationPermission,
  isNotificationSupported,
  requestNotificationPermission,
  showSessionNotification,
  wasPermissionAsked,
  wasPermissionDenied,
} from '@/lib/notifications';
import type { SessionStatus } from '@/types/sandbox';

interface UseNotificationsResult {
  /** Current notification permission status */
  permission: NotificationPermission | null;
  /** Whether notifications are supported in the current browser */
  isSupported: boolean;
  /** Whether permission status is being loaded */
  isLoading: boolean;
  /** Whether permission has been denied by the user */
  wasDenied: boolean;
  /** Whether permission has been asked before */
  wasAsked: boolean;
  /** Request notification permission from the user */
  requestPermission: () => Promise<NotificationPermission | null>;
  /** Show a session completion notification */
  showNotification: (
    sessionId: string,
    status: SessionStatus,
    prUrl?: string | null
  ) => Promise<void>;
}

/**
 * React hook for managing Web Push notifications
 *
 * Usage:
 * ```tsx
 * const { permission, isSupported, requestPermission, showNotification } = useNotifications();
 *
 * // Request permission on first sandbox start
 * if (permission === 'default') {
 *   await requestPermission();
 * }
 *
 * // Show notification when session completes
 * await showNotification(sessionId, 'completed', prUrl);
 * ```
 */
export function useNotifications(): UseNotificationsResult {
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [wasDenied, setWasDenied] = useState(false);
  const [wasAsked, setWasAsked] = useState(false);

  // Initialize on mount
  useEffect(() => {
    const init = () => {
      const supported = isNotificationSupported();
      setIsSupported(supported);

      if (supported) {
        const currentPermission = getNotificationPermission();
        setPermission(currentPermission);
        setWasDenied(wasPermissionDenied());
        setWasAsked(wasPermissionAsked());
      }

      setIsLoading(false);
    };

    init();
  }, []);

  // Listen for permission changes (user might change in browser settings)
  useEffect(() => {
    if (!isSupported) return;

    const handlePermissionChange = () => {
      const newPermission = getNotificationPermission();
      setPermission(newPermission);
      setWasDenied(wasPermissionDenied());
      setWasAsked(wasPermissionAsked());
    };

    // Check periodically in case user changes permission in browser settings
    const interval = setInterval(handlePermissionChange, 5000);

    // Also try to use the permissionchange event if available
    if ('permissions' in navigator) {
      navigator.permissions
        .query({ name: 'notifications' as PermissionName })
        .then((permissionStatus) => {
          permissionStatus.onchange = handlePermissionChange;
        })
        .catch(() => {
          // Fallback to polling
        });
    }

    return () => {
      clearInterval(interval);
    };
  }, [isSupported]);

  /**
   * Request notification permission from the user
   */
  const requestPermission = useCallback(async (): Promise<NotificationPermission | null> => {
    if (!isSupported) {
      console.log('[useNotifications] Notifications not supported');
      return null;
    }

    try {
      const newPermission = await requestNotificationPermission();
      setPermission(newPermission);
      setWasDenied(wasPermissionDenied());
      setWasAsked(wasPermissionAsked());
      return newPermission;
    } catch (error) {
      console.error('[useNotifications] Failed to request permission:', error);
      return null;
    }
  }, [isSupported]);

  /**
   * Show a session completion notification
   */
  const showNotification = useCallback(
    async (sessionId: string, status: SessionStatus, prUrl?: string | null): Promise<void> => {
      await showSessionNotification(sessionId, status, prUrl);
    },
    []
  );

  return {
    permission,
    isSupported,
    isLoading,
    wasDenied,
    wasAsked,
    requestPermission,
    showNotification,
  };
}
