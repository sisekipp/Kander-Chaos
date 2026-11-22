/**
 * Auswahl der Wahrzeichen (Spec graphics-assets, Wahrzeichen): besondere Gebäude in allen Ortsteilen und
 * Nachbargemeinden bekommen ein eigenes Modell. Reine Logik ohne Dateizugriff.
 */
import { centroid, orientedRect, type Building } from '@kandern/world-format';

/** Bauvorlage im Blender-Skript. */
export type LandmarkStyle =
  | 'church'
  | 'chapel'
  | 'townhall'
  | 'school'
  | 'kindergarten'
  | 'station'
  | 'goods_shed'
  | 'supermarket'
  | 'fire_station'
  | 'museum'
  | 'manor'
  | 'castle'
  | 'ruin'
  | 'hall'
  | 'civic'
  | 'inn';

export interface LandmarkOverride {
  id?: string;
  name?: string;
  style?: LandmarkStyle;
  /** Handgebaute Variante im Blender-Skript (z. B. „stadtkirche“). */
  detail?: string;
}

export interface LandmarkExtra {
  id: string;
  name: string;
  style: LandmarkStyle;
  detail?: string;
  x: number;
  z: number;
  /** Ausdehnung [quer, längs] in m. */
  size: [number, number];
}

export interface Landmark {
  id: string;
  name: string;
  style: LandmarkStyle;
  detail: string | null;
  /** Gebäude-ID im Kachelformat (wird im Nahbereich nicht generiert) oder null (freies Wahrzeichen). */
  buildingId: number | null;
  /** Mitte in Weltkoordinaten. */
  x: number;
  z: number;
  /** Richtung der Längsachse (Einheitsvektor in Weltkoordinaten). */
  ux: number;
  uz: number;
  /** Grundriss im Modellsystem: lx entlang der Längsachse, lz quer (lz = Welt · (−uz, ux)), flach. */
  footprint: number[];
  wallHeight: number;
  roofHeight: number;
  levels: number;
}

export interface RawLandmarkBuilding {
  id: number;
  tags: Record<string, string>;
  /** Außenring in Weltkoordinaten (flach, ohne Schlusspunkt). */
  outline: number[];
}

/** OSM-ID aus der stabilen Gebäude-ID (Typ · 1e12 + ID). */
export const osmIdOf = (stableId: number): number => Math.round(stableId) % 1e12;

/** Bauvorlage nach OSM-Merkmalen oder null (kein Wahrzeichen). */
export function styleOf(tags: Record<string, string>, area: number): LandmarkStyle | null {
  const b = tags.building ?? '';
  const a = tags.amenity ?? '';
  const name = tags.name ?? '';
  if (b === 'church' || b === 'chapel' || b === 'cathedral' || a === 'place_of_worship')
    return b === 'chapel' || area < 120 ? 'chapel' : 'church';
  if (a === 'townhall' || /Rathaus/.test(name)) return 'townhall';
  if (b === 'kindergarten' || a === 'kindergarten') return 'kindergarten';
  if (b === 'school' || b === 'college' || b === 'university' || a === 'school' || a === 'college') return 'school';
  if (b === 'train_station' || tags.railway === 'station' || tags.railway === 'halt') return 'station';
  if (tags.shop === 'supermarket') return 'supermarket';
  if (a === 'fire_station' || b === 'fire_station') return 'fire_station';
  if (tags.tourism === 'museum') return 'museum';
  if (tags.historic === 'castle' || tags.historic === 'manor') return 'manor';
  if (tags.historic === 'ruins') return 'ruin';
  if (b === 'sports_hall' || tags.leisure === 'sports_hall') return 'hall';
  if (b === 'civic' || b === 'public' || a === 'community_centre' || a === 'library') return 'civic';
  if (b === 'hotel' || tags.tourism === 'hotel' || a === 'restaurant') return 'inn';
  return null;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

/** Grundriss in das Modellsystem (Mitte, Längsachse) drehen. */
export function localFootprint(ring: number[], cx: number, cz: number, ux: number, uz: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < ring.length; i += 2) {
    const dx = ring[i] - cx,
      dz = ring[i + 1] - cz;
    out.push(Math.round((dx * ux + dz * uz) * 100) / 100, Math.round((-dx * uz + dz * ux) * 100) / 100);
  }
  return out;
}

const round = (v: number, f = 100) => Math.round(v * f) / f;

/**
 * Wahrzeichen aus den Gebäuden (automatisch nach Art, Überschreibungen nach OSM-ID) und freie Extras.
 * `placed` liefert Höhen und Stockwerke nach den Ergänzungsregeln. Ergebnis nach ID sortiert, IDs eindeutig.
 */
export function selectLandmarks(
  raw: RawLandmarkBuilding[],
  placed: Map<number, Building>,
  overrides: Record<string, LandmarkOverride>,
  extras: LandmarkExtra[] = [],
): Landmark[] {
  const out: Landmark[] = [];
  const used = new Set<string>();
  const unique = (base: string) => {
    let id = base,
      k = 2;
    while (used.has(id)) id = `${base}-${k++}`;
    used.add(id);
    return id;
  };
  for (const rb of raw) {
    const b = placed.get(rb.id);
    if (!b) continue;
    const ov = overrides[String(osmIdOf(rb.id))];
    const ring = rb.outline;
    const r = orientedRect(ring);
    const area = 4 * r.halfLong * r.halfShort;
    const style = ov?.style ?? styleOf(rb.tags, area);
    if (!style) continue;
    const [cx, cz] = centroid(ring);
    const name = ov?.name ?? rb.tags.name ?? '';
    out.push({
      id: unique(ov?.id ?? `${style}-${slug(name) || osmIdOf(rb.id)}`),
      name,
      style,
      detail: ov?.detail ?? null,
      buildingId: rb.id,
      x: round(cx),
      z: round(cz),
      ux: round(r.ux, 1e4),
      uz: round(r.uz, 1e4),
      footprint: localFootprint(ring, cx, cz, r.ux, r.uz),
      wallHeight: round(b.wallHeight),
      roofHeight: round(b.roofHeight),
      levels: b.levels,
    });
  }
  for (const e of extras) {
    const [w, l] = e.size;
    out.push({
      id: unique(e.id),
      name: e.name,
      style: e.style,
      detail: e.detail ?? null,
      buildingId: null,
      x: round(e.x),
      z: round(e.z),
      ux: 1,
      uz: 0,
      footprint: [-l / 2, -w / 2, l / 2, -w / 2, l / 2, w / 2, -l / 2, w / 2],
      wallHeight: 0,
      roofHeight: 0,
      levels: 0,
    });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}
