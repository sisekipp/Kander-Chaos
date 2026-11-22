import { useEffect } from 'react';
import { useGameStore } from '../state/store.ts';
import { ensureWorld, requestPersistence } from '../offline/worldDownloader.ts';

/**
 * Erster Start: lädt alle Weltdaten mit Fortschritt und meldet "Bereit zum Offline-Spielen".
 * Danach (offline oder online) geht es direkt ins Menü.
 */
export function LoadingScreen() {
  const d = useGameStore((s) => s.download);
  const setDownload = useGameStore((s) => s.setDownload);
  const setScreen = useGameStore((s) => s.setScreen);
  const setStorage = useGameStore((s) => s.setStorage);

  const run = () => {
    setDownload({ phase: 'checking', message: 'Weltdaten werden geprüft …' });
    let sawDownload = false;
    ensureWorld((p) => {
      sawDownload = sawDownload || p.totalBytes > 0;
      setDownload({
        phase: 'downloading',
        fraction: p.fraction,
        loadedMb: p.loadedBytes / 1048576,
        totalMb: p.totalBytes / 1048576,
        message: '',
      });
    })
      .then(async (st) => {
        if (st.state === 'needs-network') {
          setDownload({ phase: 'needs-network', message: st.message });
          return;
        }
        setStorage(await requestPersistence());
        setDownload({ phase: 'ready', fraction: 1, message: sawDownload ? 'Bereit zum Offline-Spielen' : '' });
        if (st.updatePending) useGameStore.getState().setUpdateReady(true);
        if (!sawDownload) setScreen('menu');
      })
      .catch((e) =>
        setDownload({
          phase: 'error',
          message: `Download unterbrochen: ${(e as Error).message}. Bereits geladene Daten bleiben erhalten.`,
        }),
      );
  };

  useEffect(run, []);

  return (
    <div className="panel center loading">
      <h1>Kandern Chaos</h1>
      {d.phase === 'downloading' && (
        <>
          <p>Die Welt wird auf dieses Gerät geladen – danach geht alles ohne Internet.</p>
          <div
            className="progress"
            role="progressbar"
            aria-valuenow={Math.round(d.fraction * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="progress-bar" style={{ width: `${(d.fraction * 100).toFixed(1)}%` }} />
          </div>
          <p className="big">{Math.floor(d.fraction * 100)} %</p>
          <p className="status">
            {d.loadedMb.toFixed(1)} von {d.totalMb.toFixed(1)} MB
          </p>
        </>
      )}
      {d.phase === 'checking' && <p>{d.message}</p>}
      {d.phase === 'ready' && d.message && (
        <>
          <p className="big ok">✔ {d.message}</p>
          <div className="stack">
            <button onClick={() => setScreen('menu')}>Los geht’s</button>
          </div>
        </>
      )}
      {(d.phase === 'error' || d.phase === 'needs-network') && (
        <>
          <p>{d.message}</p>
          <div className="stack">
            <button onClick={run}>Erneut versuchen</button>
          </div>
        </>
      )}
    </div>
  );
}
