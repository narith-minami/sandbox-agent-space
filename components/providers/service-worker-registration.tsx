'use client';

import { useEffect } from 'react';

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Service Worker Registration Component
 * Registers the service worker for push notifications on mount
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    // Only run on the client side
    if (typeof window === 'undefined') return;

    // Check if service workers are supported
    if ('serviceWorker' in navigator) {
      // Register service worker
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          if (isDevelopment) {
            console.log('Service Worker registered:', registration.scope);
          }
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    } else if (isDevelopment) {
      console.log('Service Workers not supported in this browser');
    }
  }, []);

  return null;
}
