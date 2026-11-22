/** Registriert den Service Worker (nur im Produktions-Build) und meldet wartende Updates. */
export function registerServiceWorker(onUpdateReady: () => void): void {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
      const watch = (w: ServiceWorker | null) => {
        if (!w) return;
        w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) onUpdateReady();
        });
      };
      if (reg.waiting && navigator.serviceWorker.controller) onUpdateReady();
      watch(reg.installing);
      reg.addEventListener('updatefound', () => watch(reg.installing));
      // Online regelmäßig nach neuen Versionen sehen (stündlich)
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    } catch (e) {
      console.warn('[sw] Registrierung fehlgeschlagen', e);
    }
  });
}

/** Aktiviert eine wartende App-Version und lädt neu, sobald sie übernommen hat. */
export async function activateWaitingServiceWorker(): Promise<void> {
  const reg = await navigator.serviceWorker?.getRegistration();
  if (reg?.waiting) {
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  } else {
    location.reload();
  }
}
