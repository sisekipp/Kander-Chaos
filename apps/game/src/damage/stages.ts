/** Sichtbare Schadensstufen (reine Logik): Färbung ab 70 %, Teile + dünner Rauch ab 40 %, dichter Rauch ab 15 %. */
export type Smoke = 'none' | 'thin' | 'thick';

export interface DamageLook {
  /** Helligkeitsfaktor des Lacks (1 = neu). */
  tint: number;
  /** Wie viele lösbare Teile insgesamt abgefallen sein sollen. */
  partsOff: number;
  smoke: Smoke;
  wrecked: boolean;
}

export function damageLook(health: number, detachableCount: number): DamageLook {
  if (health <= 0) return { tint: 0.35, partsOff: detachableCount, smoke: 'thick', wrecked: true };
  // unter 70 % dunkler werdend: 0,9 bei 70 % bis 0,6 kurz vor dem Totalschaden
  const tint = health < 0.7 ? 0.6 + 0.3 * (health / 0.7) : 1;
  let partsOff = 0;
  if (health < 0.4) partsOff = 1;
  if (health < 0.25) partsOff = 2;
  if (health < 0.15) partsOff = 3;
  const smoke: Smoke = health < 0.15 ? 'thick' : health < 0.4 ? 'thin' : 'none';
  return { tint, partsOff: Math.min(detachableCount, partsOff), smoke, wrecked: false };
}

/** Farbe des Zustandsbalkens (grün -> gelb -> rot). */
export function healthColor(health: number): 'green' | 'yellow' | 'red' {
  return health < 0.4 ? 'red' : health < 0.7 ? 'yellow' : 'green';
}
