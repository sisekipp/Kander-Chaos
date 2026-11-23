import { useGameStore } from '../../state/store.ts';

/** Hinweis am Rand einer Region, die gerade nicht geladen werden kann (offline oder Fehler). */
export function RegionEdgeHint() {
  const edge = useGameStore((s) => s.regionEdge);
  if (!edge) return null;
  return (
    <div className="region-hint" role="status">
      Hier geht es gerade nicht weiter – diese Gegend braucht Internet zum Laden.
    </div>
  );
}
