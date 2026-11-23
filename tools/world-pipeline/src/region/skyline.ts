/**
 * Fernsicht-Liste der hohen Gebäude (Spec world-data-pipeline „Hochhaushöhen“): alle Gebäude ab 40 m mit
 * Weltlage, Gesamthöhe und Grundriss-Ausdehnung. Daraus zeichnet das Spiel Silhouetten jenseits der geladenen
 * Kacheln. Reine Funktion.
 */
import type { TileData } from '@kandern/world-format';

export const SKYLINE_MIN_HEIGHT = 40;

export interface SkylineEntry {
  id: number;
  /** Mittelpunkt in Weltkoordinaten (m). */
  x: number;
  z: number;
  /** Gesamthöhe (Wand + Dach) in m. */
  h: number;
  /** Ausdehnung der Bounding-Box in x/z (m). */
  w: number;
  d: number;
  /** Wahrzeichen an dieser Stelle (Fernsicht zeigt dann dessen vereinfachte Form). */
  landmarkId?: string;
}

/** Wahrzeichen-Angaben für die Liste: Sollhöhe ersetzt die geschätzte Gebäudehöhe. */
export interface SkylineLandmark {
  id: string;
  buildingId: number | null;
  x: number;
  z: number;
  height?: number;
  /** Ausdehnung längs/quer (m) für freie Wahrzeichen. */
  size?: [number, number];
}

export function buildSkyline(
  tiles: TileData[],
  minHeight = SKYLINE_MIN_HEIGHT,
  landmarks: SkylineLandmark[] = [],
): SkylineEntry[] {
  const byBuilding = new Map(landmarks.flatMap((l) => (l.buildingId === null ? [] : [[l.buildingId, l] as const])));
  const out: SkylineEntry[] = [];
  for (const t of tiles)
    for (const b of t.buildings) {
      const lm = byBuilding.get(b.id);
      const h = lm?.height ?? b.wallHeight + b.roofHeight;
      if (h < minHeight && !lm?.height) continue;
      let x0 = Infinity,
        x1 = -Infinity,
        z0 = Infinity,
        z1 = -Infinity;
      for (let i = 0; i < b.outline.length; i += 2) {
        x0 = Math.min(x0, b.outline[i]);
        x1 = Math.max(x1, b.outline[i]);
        z0 = Math.min(z0, b.outline[i + 1]);
        z1 = Math.max(z1, b.outline[i + 1]);
      }
      const r = (v: number) => Math.round(v * 10) / 10;
      out.push({
        id: b.id,
        x: r(t.tx * t.size + (x0 + x1) / 2),
        z: r(t.tz * t.size + (z0 + z1) / 2),
        h: r(h),
        w: r(x1 - x0),
        d: r(z1 - z0),
        ...(lm ? { landmarkId: lm.id } : {}),
      });
    }
  // freie Wahrzeichen mit Sollhöhe (Tower, Brücken, Stadion) direkt aus ihrer Lage
  for (const l of landmarks)
    if (l.buildingId === null && l.height !== undefined && l.height >= 20 && l.size)
      out.push({ id: -1, x: l.x, z: l.z, h: l.height, w: l.size[1], d: l.size[0], landmarkId: l.id });
  // Gebäude über Kachelgrenzen kommen mehrfach vor: höchsten Eintrag je ID behalten
  const best = new Map<number | string, SkylineEntry>();
  for (const e of out) {
    const key = e.id === -1 ? e.landmarkId! : e.id;
    if (!best.has(key) || best.get(key)!.h < e.h) best.set(key, e);
  }
  return [...best.values()].sort((a, b) => b.h - a.h || a.id - b.id);
}
