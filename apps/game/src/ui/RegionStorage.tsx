import { useState } from 'react';
import { clearRegions, regionUsage } from '../offline/regions.ts';

/** Einstellungen: belegter Speicher der nachgeladenen Regionen und Löschen (Spielstand bleibt). */
export function RegionStorage() {
  const [usage, setUsage] = useState(regionUsage);
  const mb = (usage.bytes / 1048576).toFixed(0);
  return (
    <div className="row" data-testid="region-storage">
      <span>
        Gespeicherte Regionen: {usage.count} ({mb} MB)
      </span>
      <button
        className="secondary"
        disabled={usage.count === 0}
        onClick={async () => {
          await clearRegions();
          setUsage(regionUsage());
        }}
      >
        Gespeicherte Regionen löschen
      </button>
    </div>
  );
}
