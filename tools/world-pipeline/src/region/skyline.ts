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
}

export function buildSkyline(tiles: TileData[], minHeight = SKYLINE_MIN_HEIGHT): SkylineEntry[] {
  const out: SkylineEntry[] = [];
  for (const t of tiles)
    for (const b of t.buildings) {
      const h = b.wallHeight + b.roofHeight;
      if (h < minHeight) continue;
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
      });
    }
  // Gebäude über Kachelgrenzen kommen mehrfach vor: höchsten Eintrag je ID behalten
  const best = new Map<number, SkylineEntry>();
  for (const e of out) if (!best.has(e.id) || best.get(e.id)!.h < e.h) best.set(e.id, e);
  return [...best.values()].sort((a, b) => b.h - a.h || a.id - b.id);
}
