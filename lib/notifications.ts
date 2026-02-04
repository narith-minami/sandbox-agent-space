/**
 * Notification utilities for Web Push notifications
 * Handles permission requests, notification display, and localStorage persistence
 */

import type { SessionStatus } from '@/types/sandbox';

// localStorage keys
const PERMISSION_DENIED_KEY = 'notification-permission-denied';
const PERMISSION_ASKED_KEY = 'notification-permission-asked';

/**
 * Browser notification utilities for session status changes
 */

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Log message in development mode only
 */
function devLog(...args: unknown[]) {
  if (isDevelopment) {
    console.log(...args);
  }
}

/**
 * Log warning in development mode only
 */
function devWarn(...args: unknown[]) {
  if (isDevelopment) {
    console.warn(...args);
  }
}

/**
 * Log error in development mode only
 */
function devError(...args: unknown[]) {
  if (isDevelopment) {
    console.error(...args);
  }
}

/**
 * Check if the browser supports notifications and service workers
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

/**
 * Get current notification permission status
 * Returns null if notifications are not supported
 */
export function getNotificationPermission(): NotificationPermission | null {
  if (!isNotificationSupported()) {
    return null;
  }
  return Notification.permission;
}

/**
 * Check if notification permission was already denied by the user
 */
export function wasPermissionDenied(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(PERMISSION_DENIED_KEY) === 'true';
}

/**
 * Check if permission has been asked before
 */
export function wasPermissionAsked(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(PERMISSION_ASKED_KEY) === 'true';
}

/**
 * Mark permission as denied in localStorage
 */
export function markPermissionDenied(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PERMISSION_DENIED_KEY, 'true');
  localStorage.setItem(PERMISSION_ASKED_KEY, 'true');
}

/**
 * Mark permission as asked in localStorage
 */
export function markPermissionAsked(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PERMISSION_ASKED_KEY, 'true');
}

/**
 * Request notification permission from the user
 * Returns the new permission status
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) {
    throw new Error('Notifications are not supported in this browser');
  }

  markPermissionAsked();

  const permission = await Notification.requestPermission();

  if (permission === 'denied') {
    markPermissionDenied();
  }

  return permission;
}

/**
 * Get service worker registration
 */
async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isNotificationSupported()) {
    devLog('[Notifications] Service worker not supported');
    return null;
  }

  try {
    devLog('[Notifications] Waiting for service worker to be ready...');
    const registration = await navigator.serviceWorker.ready;

    // Check if service worker is actually active
    const sw = registration.active || registration.installing || registration.waiting;
    if (sw) {
      devLog('[Notifications] Service worker state:', sw.state);

      // If service worker is not activated yet, wait a bit
      if (sw.state !== 'activated') {
        devWarn('[Notifications] Service worker not yet activated, current state:', sw.state);
      }
    } else {
      devError('[Notifications] No service worker instance found in registration');
    }

    devLog('[Notifications] Service worker registration ready:', {
      scope: registration.scope,
      active: !!registration.active,
      installing: !!registration.installing,
      waiting: !!registration.waiting,
    });

    return registration;
  } catch (error) {
    devError('[Notifications] Failed to get service worker registration:', error);
    return null;
  }
}

/**
 * Show a session completion notification
 * Uses service worker to display notification (works even when tab is not focused)
 */
export async function showSessionNotification(
  sessionId: string,
  status: SessionStatus,
  prUrl?: string | null
): Promise<void> {
  devLog('[Notifications] showSessionNotification called:', {
    sessionId: sessionId.slice(0, 8),
    status,
    prUrl: prUrl ? 'present' : 'none',
  });

  // Only show notifications for terminal statuses
  if (status !== 'completed' && status !== 'failed') {
    devLog('[Notifications] Status not terminal, skipping notification:', status);
    return;
  }

  // Check if notifications are supported and permitted
  if (!isNotificationSupported()) {
    devLog('[Notifications] Notifications not supported');
    return;
  }

  const permission = getNotificationPermission();
  if (permission !== 'granted') {
    devLog('[Notifications] Permission not granted:', permission);
    return;
  }

  devLog('[Notifications] Permission granted, getting service worker registration...');

  // Get service worker registration
  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    devError('[Notifications] Service worker not registered');
    return;
  }

  // Build notification content
  const isSuccess = status === 'completed';
  const title = isSuccess ? 'Session Completed' : 'Session Failed';
  const icon = isSuccess ? '✅' : '❌';

  // Build body text
  let body = `${icon} Session ${sessionId.slice(0, 8)}`;
  if (prUrl) {
    // Extract PR info from URL (e.g., github.com/owner/repo/pull/123)
    try {
      const prMatch = prUrl.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
      if (prMatch) {
        body += ` | PR: ${prMatch[1]}#${prMatch[2]}`;
      } else {
        body += ' | PR available';
      }
    } catch {
      body += ' | PR available';
    }
  } else {
    body += isSuccess ? ' completed successfully' : ' failed';
  }

  devLog('[Notifications] Showing notification:', { title, body });

  // Show notification via service worker
  try {
    await registration.showNotification(title, {
      body,
      tag: `session-${sessionId}`,
      requireInteraction: false,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: {
        sessionId,
        prUrl: prUrl || undefined,
        status,
      },
    });

    devLog('[Notifications] Notification shown successfully:', title, sessionId.slice(0, 8));
  } catch (error) {
    devError('[Notifications] Failed to show notification:', error);
    // Don't re-throw - handle gracefully to avoid breaking the caller
  }
}
