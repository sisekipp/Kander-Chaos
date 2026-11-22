/** Platzierung der Wahrzeichen (reine Rechnung): Drehung, Weltlage des Grundrisses, Bodenhöhe, Kachel. */

/** Eintrag aus `world/landmarks.json` (Welt-Pipeline, `landmarks/select.ts`). */
export interface LandmarkInfo {
  id: string;
  name: string;
  style: string;
  detail: string | null;
  buildingId: number | null;
  x: number;
  z: number;
  ux: number;
  uz: number;
  /** Modellsystem: lx entlang (ux, uz), lz entlang (−uz, ux), flach. */
  footprint: number[];
  wallHeight: number;
  roofHeight: number;
  levels: number;
  /** Fußpunkt aus dem DGM (tiefste Höhe unter dem Grundriss); fehlt in älteren Daten. */
  ground?: number;
}

/** Modell-ID in der Registry. */
export const landmarkModelId = (l: LandmarkInfo): string => `landmark-${l.id}`;

/**
 * Babylon-Drehung um y, die das Modellsystem (lx, lz) auf die Welt abbildet: Babylon dreht
 * (x, z) → (x cos θ + z sin θ, −x sin θ + z cos θ); gesucht (1, 0) → (ux, uz).
 */
export const rotationY = (l: Pick<LandmarkInfo, 'ux' | 'uz'>): number => Math.atan2(-l.uz, l.ux);

/** Punkt des Modellsystems in Weltkoordinaten. */
export function toWorld(l: LandmarkInfo, lx: number, lz: number): [number, number] {
  return [l.x + lx * l.ux - lz * l.uz, l.z + lx * l.uz + lz * l.ux];
}

/** Tiefste Geländehöhe unter Mitte und Grundrissecken (Modell steht dort, Sockel reicht nach unten). */
export function groundFor(l: LandmarkInfo, heightAt: (x: number, z: number) => number | null): number | null {
  let min = heightAt(l.x, l.z);
  if (min === null) return null;
  for (let i = 0; i < l.footprint.length; i += 2) {
    const [x, z] = toWorld(l, l.footprint[i], l.footprint[i + 1]);
    const h = heightAt(x, z);
    if (h !== null && h < min) min = h;
  }
  return min;
}

/** Kachel-ID der Wahrzeichen-Mitte (gleiche Zuordnung wie die Gebäude: Schwerpunkt). */
export const tileOfLandmark = (l: LandmarkInfo, tileSize: number): string =>
  `${Math.floor(l.x / tileSize)},${Math.floor(l.z / tileSize)}`;
