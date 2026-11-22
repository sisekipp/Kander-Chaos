import { useState } from 'react';
import { getGame } from '../engine/gameInstance.ts';
import { hideStressScene, runMeasurement, runPhysicsStress, showStressScene } from '../engine/devTools.ts';
import type { MeasurementReport } from '../engine/perf/FrameRecorder.ts';

/** Werkzeuge für den Machbarkeits-Spike (Testmodus). */
export function DevPanel({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState('');
  const [last, setLast] = useState<MeasurementReport | null>(null);
  const [busy, setBusy] = useState(false);

  const withGame = (fn: (g: NonNullable<ReturnType<typeof getGame>>) => void | Promise<void>) => async () => {
    const g = getGame();
    if (!g) return;
    try {
      await fn(g);
    } catch (e) {
      setStatus(`Fehler: ${(e as Error).message}`);
    }
  };

  return (
    <div className="panel dev-panel">
      <h2>Spike-Werkzeuge</h2>
      <div className="stack">
        <button
          onClick={withGame((g) => {
            const s = showStressScene(g);
            setStatus(
              `Stress-Szene: ${s.stats.buildings} Gebäude, ${s.stats.trees} Bäume, ${s.stats.terrainTris} Gelände-Dreiecke`,
            );
          })}
        >
          Stress-Szene zeigen
        </button>
        <button
          onClick={withGame(async (g) => {
            setStatus('Havok wird geladen …');
            const ms = await runPhysicsStress(g);
            setStatus(`Havok bereit nach ${ms.toFixed(0)} ms – 50 Körper fallen`);
          })}
        >
          Physik-Test (50 Körper)
        </button>
        <button
          disabled={busy}
          onClick={withGame((g) => {
            setBusy(true);
            setStatus('Messlauf läuft (20 s) …');
            runMeasurement(g, 'stress', 20, (r) => {
              setBusy(false);
              setLast(r);
              setStatus('Messlauf fertig – JSON wurde heruntergeladen');
            });
          })}
        >
          {busy ? 'Messe …' : 'Messlauf 20 s'}
        </button>
        <button
          className="secondary"
          onClick={() => {
            hideStressScene();
            setStatus('Stress-Szene entfernt');
          }}
        >
          Stress-Szene entfernen
        </button>
        <button className="secondary" onClick={onClose}>
          Schließen
        </button>
      </div>
      {status && <p className="status">{status}</p>}
      {last && (
        <p className="status">
          Ø {last.summary.avgFps.toFixed(1)} fps · 1 %-Low {last.summary.p1LowFps.toFixed(1)} fps · max{' '}
          {last.summary.maxFrameMs.toFixed(0)} ms
        </p>
      )}
    </div>
  );
}
