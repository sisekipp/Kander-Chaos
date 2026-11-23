/**
 * Pisten, Rollwege und Bahnsteige sind in OSM oft Linien mit Breite: hier zu Flächen verbreitert
 * (Spec world-data-pipeline, Autobahnen, Bahnstrecken und Flughafen). Reine Logik.
 */
import { LandKind } from '@kandern/world-format';

const DEFAULT_WIDTH: Partial<Record<LandKind, number>> = {
  [LandKind.Runway]: 60,
  [LandKind.Taxiway]: 23,
  [LandKind.Platform]: 5,
};

/** Flächenart einer Linie oder null. */
export function lineLandKind(tags: Record<string, string>): LandKind | null {
  if (tags.aeroway === 'runway') return LandKind.Runway;
  if (tags.aeroway === 'taxiway') return LandKind.Taxiway;
  if (tags.railway === 'platform' || tags.public_transport === 'platform') return LandKind.Platform;
  return null;
}

/** Breite in m aus `width` oder Standard der Art. */
export function lineWidth(tags: Record<string, string>, kind: LandKind): number {
  const w = Number.parseFloat(tags.width ?? '');
  return Number.isFinite(w) && w > 0 ? w : (DEFAULT_WIDTH[kind] ?? 5);
}

/** Linie [x0,z0,…] zu einem Ring der halben Breite verbreitern (Gehrung an Knicken, gedeckelt). */
export function bufferLine(coords: number[], width: number): number[] | null {
  const n = coords.length / 2;
  if (n < 2) return null;
  const h = width / 2;
  const left: number[] = [],
    right: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = i > 0 ? i - 1 : i,
      q = i < n - 1 ? i + 1 : i;
    let dx = coords[q * 2] - coords[p * 2],
      dz = coords[q * 2 + 1] - coords[p * 2 + 1];
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) continue;
    dx /= len;
    dz /= len;
    const x = coords[i * 2],
      z = coords[i * 2 + 1];
    left.push(x - dz * h, z + dx * h);
    right.push(x + dz * h, z - dx * h);
  }
  if (left.length < 4) return null;
  const ring = [...left];
  for (let i = right.length - 2; i >= 0; i -= 2) ring.push(right[i], right[i + 1]);
  return ring;
}
