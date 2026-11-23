/**
 * Regionales Spielgebiet (Spec world-data-pipeline, Abdeckung): festes Rechteck Müllheim – Lörrach – Basel –
 * EuroAirport. Die Gemeinde Kandern mit Randstreifen ist die Kernregion (offline vorgeladen), alle übrigen
 * Kacheln sind Nachladeregionen (Spec regional-streaming).
 */
import type { StudyArea } from '../area.ts';

export interface LatLonBox {
  south: number;
  north: number;
  west: number;
  east: number;
}

/** Spielgebiet: Müllheim (N), Lörrach (O), Basel-Süd (S), Rhein/EuroAirport (W). */
export const PLAY_AREA: LatLonBox = { south: 47.515, north: 47.815, west: 7.515, east: 7.75 };

export interface Rect {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

/** Rechteck in Weltkoordinaten, das alle vier Ecken der lat/lon-Box umschließt. */
export function worldRect(box: LatLonBox, project: (p: { lat: number; lon: number }) => [number, number]): Rect {
  const pts = [
    project({ lat: box.south, lon: box.west }),
    project({ lat: box.south, lon: box.east }),
    project({ lat: box.north, lon: box.west }),
    project({ lat: box.north, lon: box.east }),
  ];
  return {
    minX: Math.min(...pts.map((p) => p[0])),
    maxX: Math.max(...pts.map((p) => p[0])),
    minZ: Math.min(...pts.map((p) => p[1])),
    maxZ: Math.max(...pts.map((p) => p[1])),
  };
}

export interface RegionalArea extends StudyArea {
  /** Gehört die Kachel zur Kernregion (Gemeinde Kandern + Randstreifen)? */
  isCoreTile(tx: number, tz: number): boolean;
}

/** Spielgebiet aus Rechteck und Kernregion; Kacheln im Rechteck oder in der Kernregion gehören dazu. */
export function regionalArea(core: StudyArea, rect: Rect, tileSize: number): RegionalArea {
  const inRect = (tx: number, tz: number) =>
    (tx + 1) * tileSize > rect.minX &&
    tx * tileSize < rect.maxX &&
    (tz + 1) * tileSize > rect.minZ &&
    tz * tileSize < rect.maxZ;
  return {
    boundary: core.boundary,
    minX: Math.min(core.minX, rect.minX),
    minZ: Math.min(core.minZ, rect.minZ),
    maxX: Math.max(core.maxX, rect.maxX),
    maxZ: Math.max(core.maxZ, rect.maxZ),
    includesTile: (tx, tz) => core.includesTile(tx, tz) || inRect(tx, tz),
    isCoreTile: (tx, tz) => core.includesTile(tx, tz),
  };
}

/** Ist ein Regionspaket Teil der Kernregion? Ja, sobald eine seiner Kacheln zum Kern gehört. */
export function isCorePack(tiles: { tx: number; tz: number }[], area: RegionalArea): boolean {
  return tiles.some((t) => area.isCoreTile(t.tx, t.tz));
}

/** Nachladepaket? Nur im regionalen Gebiet und nur, wenn keine Kachel zur Kernregion gehört. */
export function isRemotePack(tiles: { tx: number; tz: number }[], area: object): boolean {
  return 'isCoreTile' in area && !isCorePack(tiles, area as RegionalArea);
}
