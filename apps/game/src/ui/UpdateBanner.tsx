import { useEffect } from 'react';
import { useGameStore } from '../state/store.ts';
import { applyPendingWorld } from '../offline/worldDownloader.ts';
import { activateWaitingServiceWorker } from '../offline/swClient.ts';

/** Hinweis "Update bereit" – aktiviert erst auf Klick (laufendes Spiel wird nicht unterbrochen). */
export function UpdateBanner() {
  const ready = useGameStore((s) => s.updateReady);
  const setReady = useGameStore((s) => s.setUpdateReady);
  useEffect(() => {
    const on = () => setReady(true);
    window.addEventListener('kc-world-update-ready', on);
    return () => window.removeEventListener('kc-world-update-ready', on);
  }, [setReady]);
  if (!ready) return null;
  return (
    <div className="update-banner panel" role="status">
      <span>Update bereit</span>
      <button
        onClick={async () => {
          await applyPendingWorld();
          await activateWaitingServiceWorker();
        }}
      >
        Jetzt aktualisieren
      </button>
      <button className="secondary" onClick={() => setReady(false)}>
        Später
      </button>
    </div>
  );
}
