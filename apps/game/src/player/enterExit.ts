/** Ein-/Aussteigen (reine Logik): Reichweite und Wahl einer freien Absetzstelle (Spec vehicles). */

export const ENTER_RANGE = 3;
/** Über diesem Tempo wird vor dem Aussteigen automatisch gebremst (m/s, = 15 km/h). */
export const EXIT_BRAKE_SPEED = 15 / 3.6;

export interface ExitCandidate {
  x: number;
  z: number;
  side: 'links' | 'rechts' | 'hinten' | 'vorne';
}

/**
 * Kandidaten für die Absetzstelle in Prüfreihenfolge: links (Fahrerseite), rechts, hinten, vorne –
 * jeweils 0,9 m außerhalb der Karosserie.
 */
export function exitCandidates(
  x: number,
  z: number,
  heading: number,
  halfWidth: number,
  halfLength: number,
): ExitCandidate[] {
  const fx = Math.sin(heading),
    fz = Math.cos(heading);
  const rx = Math.cos(heading),
    rz = -Math.sin(heading);
  const side = halfWidth + 0.9,
    end = halfLength + 0.9;
  return [
    { x: x - rx * side, z: z - rz * side, side: 'links' },
    { x: x + rx * side, z: z + rz * side, side: 'rechts' },
    { x: x - fx * end, z: z - fz * end, side: 'hinten' },
    { x: x + fx * end, z: z + fz * end, side: 'vorne' },
  ];
}

/** Erste freie Stelle oder null (dann setzt der Aufrufer die Figur über das Fahrzeug). */
export function chooseExit(candidates: ExitCandidate[], isFree: (c: ExitCandidate) => boolean): ExitCandidate | null {
  return candidates.find(isFree) ?? null;
}
