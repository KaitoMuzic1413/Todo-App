import { setWaitingPwaWorker } from './lib/pwaUpdates';

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  window.addEventListener('load', () => {
    const scriptUrl = `/sw.js?version=${encodeURIComponent(__APP_VERSION__)}`;
    navigator.serviceWorker.register(scriptUrl, { updateViaCache: 'none' }).then((registration) => {
      const checkWaitingWorker = () => {
        if (registration.waiting && navigator.serviceWorker.controller) {
          setWaitingPwaWorker(registration.waiting);
        }
      };

      checkWaitingWorker();
      registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;
        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingPwaWorker(registration.waiting || installingWorker);
          }
        });
      });
      registration.update().catch(() => {});
    }).catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  });
}
