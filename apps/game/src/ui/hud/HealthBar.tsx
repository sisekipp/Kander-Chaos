import { useGameStore } from '../../state/store.ts';
import { healthColor } from '../../damage/stages.ts';

const COLORS = { green: '#4cc36b', yellow: '#f2c230', red: '#e8443a' } as const;

/** Zustand des Fahrzeugs als Balken mit Schraubenschlüssel (grün -> gelb -> rot), ohne Zahlen. */
export function HealthBar() {
  const { mode, vehicleHealth, speedKmh } = useGameStore((s) => s.play);
  if (mode !== 'driving') return null;
  const tone = healthColor(vehicleHealth);
  const color = COLORS[tone];
  return (
    <div
      className="healthbar panel"
      role="meter"
      aria-label="Fahrzeugzustand"
      aria-valuenow={Math.round(vehicleHealth * 100)}
      data-tone={tone}
    >
      <span className="wrench">🔧</span>
      <div className="bar">
        <div className="fill" style={{ width: `${Math.max(0, vehicleHealth) * 100}%`, background: color }} />
      </div>
      <span className="speed">{speedKmh} km/h</span>
    </div>
  );
}
