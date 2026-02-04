'use client';

import { useEffect } from 'react';

/**
 * Service Worker registration component
 * Registers the service worker for Web Push notifications
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration.scope);
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    } else {
      console.log('Service Workers not supported in this browser');
    }
  }, []);

  return null;
}
