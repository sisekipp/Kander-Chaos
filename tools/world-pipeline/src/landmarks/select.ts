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
  | 'inn'
  // Region (Change landmarks-region)
  | 'tower'
  | 'station_hall'
  | 'terminal'
  | 'control_tower'
  | 'hangar'
  | 'bridge'
  | 'stadium'
  | 'fair_hall'
  | 'airplane';

/** Gemeinsame Zusatzangaben für Wahrzeichen der Region. */
interface RegionFields {
  /** Sollhöhe in m (bekannte Höhe; Modell und Prüfung richten sich danach). */
  height?: number;
  /** Großes Modell (Hochhaus, Terminal): höhere Dreiecksgrenze. */
  large?: boolean;
  /** Wahrzeichen der Region (Modell wird bei Bedarf nachgeladen). */
  region?: boolean;
}

export interface LandmarkOverride extends RegionFields {
  id?: string;
  name?: string;
  style?: LandmarkStyle;
  /** Handgebaute Variante im Blender-Skript (z. B. „stadtkirche“). */
  detail?: string;
}

export interface LandmarkExtra extends RegionFields {
  /** Ausrichtung der Längsachse in Grad (0 = Norden, im Uhrzeigersinn). */
  heading?: number;
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
  /** Sollhöhe (nur Wahrzeichen der Region). */
  height?: number;
  large?: boolean;
  region?: boolean;
  /** Liegt in einer Nachladeregion (dort nur Modelle aus der Liste der Region). */
  remote?: boolean;
  /** Tiefste Geländehöhe unter Mitte und Grundrissecken (m, aus dem DGM): Fußpunkt des Modells in allen Ringen. */
  ground: number;
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

/** Zusatzangaben der Region nur übernehmen, wenn gesetzt (Kandern-Wahrzeichen bleiben unverändert). */
const regionFields = (r: RegionFields | undefined): RegionFields => ({
  ...(r?.height !== undefined ? { height: r.height } : {}),
  ...(r?.large ? { large: true } : {}),
  ...(r?.region ? { region: true } : {}),
});

/**
 * Wahrzeichen aus den Gebäuden (automatisch nach Art, Überschreibungen nach OSM-ID) und freie Extras.
 * `placed` liefert Höhen und Stockwerke nach den Ergänzungsregeln. Ergebnis nach ID sortiert, IDs eindeutig.
 */
export function selectLandmarks(
  raw: RawLandmarkBuilding[],
  placed: Map<number, Building>,
  overrides: Record<string, LandmarkOverride>,
  extras: LandmarkExtra[] = [],
  groundAt: (x: number, z: number) => number = () => 0,
): Landmark[] {
  const lowest = (l: Omit<Landmark, 'ground'>) => {
    let g = groundAt(l.x, l.z);
    for (let i = 0; i < l.footprint.length; i += 2) {
      const lx = l.footprint[i],
        lz = l.footprint[i + 1];
      g = Math.min(g, groundAt(l.x + lx * l.ux - lz * l.uz, l.z + lx * l.uz + lz * l.ux));
    }
    return round(g);
  };
  const out: Omit<Landmark, 'ground'>[] = [];
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
      ...regionFields(ov),
    });
  }
  for (const e of extras) {
    const [w, l] = e.size;
    const h = ((e.heading ?? 90) * Math.PI) / 180;
    out.push({
      id: unique(e.id),
      name: e.name,
      style: e.style,
      detail: e.detail ?? null,
      buildingId: null,
      x: round(e.x),
      z: round(e.z),
      ux: round(Math.sin(h), 1e4),
      uz: round(Math.cos(h), 1e4),
      footprint: [-l / 2, -w / 2, l / 2, -w / 2, l / 2, w / 2, -l / 2, w / 2],
      wallHeight: 0,
      roofHeight: 0,
      levels: 0,
      ...regionFields(e),
    });
  }
  return out.map((l) => ({ ...l, ground: lowest(l) })).sort((a, b) => a.id.localeCompare(b.id));
}

/** Überschreibungen, deren OSM-Gebäude nicht in der Welt gelandet ist (Tippfehler, Gebäude fehlt). */
export function missingOverrides(overrides: Record<string, LandmarkOverride>, found: Landmark[]): string[] {
  const ids = new Set(found.flatMap((l) => (l.buildingId === null ? [] : [String(osmIdOf(l.buildingId))])));
  return Object.keys(overrides)
    .filter((k) => !ids.has(k))
    .sort();
}
