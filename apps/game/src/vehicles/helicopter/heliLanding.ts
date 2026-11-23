/** Landeregeln des Hubschraubers (Spec helicopter, Landen/Aussteigen). Reine Logik. */

/** Größte erlaubte Geländeneigung zum Aufsetzen (Grad). */
export const MAX_LAND_SLOPE_DEG = 12;
/** Aussteigen nur bis zu dieser Höhe über dem Boden (m). */
export const EXIT_HEIGHT = 1;
/** Abstand der Prüfpunkte für die Neigung (m, etwa halbe Kufenlänge). */
const PROBE = 2;

/**
 * Darf an (x, z) aufgesetzt werden? Eben genug (Neigung aus vier Nachbarpunkten) und kein Hindernis
 * darüber (`topAt` = Höhe der obersten Fläche, z. B. Dach; null = nur Gelände).
 */
export function canLandAt(
  x: number,
  z: number,
  groundAt: (x: number, z: number) => number,
  topAt: (x: number, z: number) => number | null,
): boolean {
  const g = groundAt(x, z);
  const top = topAt(x, z);
  if (top !== null && top > g + 0.5) return false;
  const maxRise = Math.tan((MAX_LAND_SLOPE_DEG * Math.PI) / 180) * PROBE;
  for (const [dx, dz] of [
    [PROBE, 0],
    [-PROBE, 0],
    [0, PROBE],
    [0, -PROBE],
  ]) {
    if (Math.abs(groundAt(x + dx, z + dz) - g) > maxRise) return false;
  }
  return true;
}

/** Aussteigen erlaubt? Nur am Boden bzw. höchstens EXIT_HEIGHT darüber. */
export function canExit(y: number, ground: number): boolean {
  return y - ground <= EXIT_HEIGHT;
}

/** Ausstiegspunkt seitlich neben der Kabine (rechts, dann links), Gierwinkel wie die Fahrzeuge. */
export function exitPoints(x: number, z: number, heading: number, side = 2.6): [number, number][] {
  const rx = Math.cos(heading),
    rz = -Math.sin(heading);
  return [
    [x + rx * side, z + rz * side],
    [x - rx * side, z - rz * side],
  ];
}
