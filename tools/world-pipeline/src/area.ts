import { distanceToRing, pointInRing } from '@kandern/world-format';
import { config } from './config.ts';
import type { LatLon, OverpassResult, OsmRelation } from './osm.ts';
import { assembleRings } from './osm.ts';
import { toUtm } from './utm.ts';

/** lat/lon -> Weltkoordinaten (m, Ursprung abgezogen). x = Ost, z = Nord. */
export function projectToWorld(p: LatLon): [number, number] {
  const u = toUtm(p.lat, p.lon);
  return [u.easting - config.origin.easting, u.northing - config.origin.northing];
}

export interface StudyArea {
  /** Außenringe der Gemeinde in Weltkoordinaten (flach). */
  boundary: number[][];
  /** Weltkoordinaten-Ausdehnung inkl. Randstreifen. */
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
  /** Ist eine Kachel Teil der Welt? */
  includesTile(tx: number, tz: number): boolean;
}

export function studyAreaFromBoundary(boundaryJson: OverpassResult): StudyArea {
  const rel = boundaryJson.elements.find((e): e is OsmRelation => e.type === 'relation');
  if (!rel) throw new Error('Gemeindegrenze nicht gefunden');
  const rings = assembleRings(rel.members, 'outer', projectToWorld).map((r) => r.flat());
  if (rings.length === 0) throw new Error('Gemeindegrenze ohne geschlossenen Außenring');
  let minX = Infinity,
    minZ = Infinity,
    maxX = -Infinity,
    maxZ = -Infinity;
  for (const r of rings) {
    for (let i = 0; i < r.length; i += 2) {
      minX = Math.min(minX, r[i]);
      maxX = Math.max(maxX, r[i]);
      minZ = Math.min(minZ, r[i + 1]);
      maxZ = Math.max(maxZ, r[i + 1]);
    }
  }
  const b = config.bufferM;
  const size = config.tileSize;
  const halfDiag = (size * Math.SQRT2) / 2;
  return {
    boundary: rings,
    minX: minX - b,
    minZ: minZ - b,
    maxX: maxX + b,
    maxZ: maxZ + b,
    includesTile(tx, tz) {
      const cx = (tx + 0.5) * size,
        cz = (tz + 0.5) * size;
      // Kachel gehört dazu, wenn irgendein Teil innerhalb von Gemeinde + Randstreifen liegt.
      return rings.some((r) => pointInRing(cx, cz, r) || distanceToRing(cx, cz, r) <= b + halfDiag);
    },
  };
}

/** Alle Kacheln der Welt, stabil sortiert (Süd->Nord, West->Ost). */
export function tilesOf(area: StudyArea): { tx: number; tz: number }[] {
  const s = config.tileSize;
  const out: { tx: number; tz: number }[] = [];
  for (let tz = Math.floor(area.minZ / s); tz <= Math.floor(area.maxZ / s); tz++) {
    for (let tx = Math.floor(area.minX / s); tx <= Math.floor(area.maxX / s); tx++) {
      if (area.includesTile(tx, tz)) out.push({ tx, tz });
    }
  }
  return out;
}
