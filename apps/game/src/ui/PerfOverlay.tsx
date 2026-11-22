import { useGameStore } from '../state/store.ts';

/** Einblendbare Leistungsanzeige; wird höchstens 4x pro Sekunde neu gerendert. */
export function PerfOverlay() {
  const visible = useGameStore((s) => s.perfVisible);
  const perf = useGameStore((s) => s.perf);
  const toggle = useGameStore((s) => s.togglePerf);
  return (
    <>
      <button className="perf-toggle" onClick={toggle} aria-label="Leistungsanzeige umschalten">
        {visible ? '✕' : 'FPS'}
      </button>
      {visible && (
        <div className="perf panel" role="status">
          <div>
            <b>{perf.fps.toFixed(0)}</b> fps
          </div>
          <div>{perf.frameMs.toFixed(1)} ms</div>
          <div>{perf.drawCalls} Draw Calls</div>
          <div>{perf.loadedTiles} Kacheln</div>
          <div>{perf.memoryMb === null ? 'Speicher: n/v' : `${perf.memoryMb} MB JS`}</div>
          <div>Auflösung {(perf.renderScale * 100).toFixed(0)} %</div>
        </div>
      )}
    </>
  );
}
