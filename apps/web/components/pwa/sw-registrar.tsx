'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return;
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch(() => {
        // Offline support is progressive; the app still works without it.
      });
  }, []);
  return null;
}

/** Asks the worker to cache the field pages. Call once a session exists; before login they only redirect. */
export function warmFieldPages() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage('WARM_FIELD')).catch(() => {});
}
