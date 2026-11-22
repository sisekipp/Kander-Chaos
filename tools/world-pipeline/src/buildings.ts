import {
  BuildingType,
  RoofShape,
  centroid,
  ensureCCW,
  orientedRect,
  signedArea,
  type Building,
} from '@kandern/world-format';
import { hash01 } from './hash.ts';

/**
 * Ergänzungsregeln für Gebäude. OSM hat in Kandern für die meisten Gebäude nur einen Grundriss
 * und `building=yes|house`. Fehlendes wird hier nach festen, dokumentierten Regeln ergänzt;
 * Zufall ist immer aus der stabilen Gebäude-ID abgeleitet (deterministisch).
 *
 * Regeln (Kurzfassung):
 * - Typ aus `building=*`; `building=yes` -> Wohnhaus (>= 35 m²) oder Schuppen (< 35 m²).
 * - Fachwerk: `building:material=timber_framing` / `building:architecture=*timber*` oder
 *   Wohnhaus in einem Ortskern (`coreFactor`) mit ID-Zufall < 0.55·coreFactor.
 * - Stockwerke: `building:levels`, sonst nach Typ und Grundfläche (Tabelle LEVELS).
 * - Wandhöhe: `height` minus Dachhöhe, sonst Stockwerke · 2.9 m + 0.4 m Sockel.
 * - Dach: `roof:shape`, sonst nach Typ (Tabelle ROOF), Wohnhäuser 25 % Walmdach per ID-Zufall.
 * - Dachhöhe: `roof:height`, sonst halbe Gebäudetiefe · tan(Dachneigung), max. 9 m.
 */

export interface RawBuilding {
  id: number;
  tags: Record<string, string>;
  /** Außenring in Weltkoordinaten (flach), beliebige Orientierung. */
  outline: number[];
}

const TYPE_MAP: Record<string, BuildingType> = {
  house: BuildingType.Residential,
  residential: BuildingType.Residential,
  detached: BuildingType.Residential,
  semidetached_house: BuildingType.Residential,
  terrace: BuildingType.Residential,
  apartments: BuildingType.Residential,
  bungalow: BuildingType.Residential,
  dormitory: BuildingType.Residential,
  farm: BuildingType.Farm,
  barn: BuildingType.Farm,
  farm_auxiliary: BuildingType.Farm,
  stable: BuildingType.Farm,
  cowshed: BuildingType.Farm,
  sty: BuildingType.Farm,
  greenhouse: BuildingType.Shed,
  silo: BuildingType.Farm,
  retail: BuildingType.Commercial,
  commercial: BuildingType.Commercial,
  office: BuildingType.Commercial,
  supermarket: BuildingType.Commercial,
  hotel: BuildingType.Commercial,
  kiosk: BuildingType.Commercial,
  industrial: BuildingType.Industrial,
  warehouse: BuildingType.Industrial,
  manufacture: BuildingType.Industrial,
  hangar: BuildingType.Industrial,
  service: BuildingType.Industrial,
  church: BuildingType.Church,
  chapel: BuildingType.Church,
  cathedral: BuildingType.Church,
  school: BuildingType.Public,
  public: BuildingType.Public,
  civic: BuildingType.Public,
  townhall: BuildingType.Public,
  kindergarten: BuildingType.Public,
  train_station: BuildingType.Public,
  hospital: BuildingType.Public,
  government: BuildingType.Public,
  fire_station: BuildingType.Public,
  sports_hall: BuildingType.Public,
  garage: BuildingType.Garage,
  garages: BuildingType.Garage,
  carport: BuildingType.Garage,
  parking: BuildingType.Garage,
  shed: BuildingType.Shed,
  hut: BuildingType.Shed,
  roof: BuildingType.Shed,
  cabin: BuildingType.Shed,
  allotment_house: BuildingType.Shed,
  toilets: BuildingType.Shed,
  transformer_tower: BuildingType.Shed,
};

const ROOF_MAP: Record<string, RoofShape> = {
  flat: RoofShape.Flat,
  gabled: RoofShape.Gabled,
  hipped: RoofShape.Hipped,
  half_hipped: RoofShape.Hipped,
  pyramidal: RoofShape.Pyramidal,
  skillion: RoofShape.Skillion,
  mansard: RoofShape.Hipped,
  gambrel: RoofShape.Gabled,
  saltbox: RoofShape.Gabled,
  round: RoofShape.Gabled,
  dome: RoofShape.Pyramidal,
};

/** Standard-Dachform je Typ. */
const ROOF: Record<BuildingType, RoofShape> = {
  [BuildingType.Residential]: RoofShape.Gabled,
  [BuildingType.HalfTimbered]: RoofShape.Gabled,
  [BuildingType.Farm]: RoofShape.Gabled,
  [BuildingType.Commercial]: RoofShape.Flat,
  [BuildingType.Industrial]: RoofShape.Flat,
  [BuildingType.Public]: RoofShape.Hipped,
  [BuildingType.Church]: RoofShape.Gabled,
  [BuildingType.Garage]: RoofShape.Flat,
  [BuildingType.Shed]: RoofShape.Skillion,
};

/** Dachneigung in Grad je Typ. */
const PITCH: Record<BuildingType, number> = {
  [BuildingType.Residential]: 40,
  [BuildingType.HalfTimbered]: 50,
  [BuildingType.Farm]: 38,
  [BuildingType.Commercial]: 25,
  [BuildingType.Industrial]: 15,
  [BuildingType.Public]: 35,
  [BuildingType.Church]: 52,
  [BuildingType.Garage]: 15,
  [BuildingType.Shed]: 20,
};

/** Stockwerke je Typ, abhängig von der Grundfläche. */
function defaultLevels(type: BuildingType, area: number, r: number): number {
  switch (type) {
    case BuildingType.Residential:
      return area > 400 ? 4 : area > 180 ? 3 : area < 70 ? 1 + (r < 0.5 ? 1 : 0) : 2;
    case BuildingType.HalfTimbered:
      return area > 150 ? 3 : 2;
    case BuildingType.Farm:
      return 2;
    case BuildingType.Commercial:
      return area > 800 ? 1 : 2 + (r < 0.3 ? 1 : 0);
    case BuildingType.Industrial:
      return 2;
    case BuildingType.Public:
      return area > 600 ? 3 : 2;
    case BuildingType.Church:
      return 4;
    case BuildingType.Garage:
      return 1;
    case BuildingType.Shed:
      return 1;
  }
}

const num = (v: string | undefined): number | null => {
  if (!v) return null;
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export interface ClassifyContext {
  /** 0 = außerhalb, 1 = Mitte eines historischen Ortskerns. */
  coreFactor: number;
}

export type Classified = Omit<Building, 'id' | 'outline'>;

export function classifyBuilding(
  id: number,
  tags: Record<string, string>,
  area: number,
  halfShort: number,
  ctx: ClassifyContext,
): Classified {
  const r = hash01(id);
  let estimated = false;
  const b = tags.building ?? 'yes';
  let type = TYPE_MAP[b] ?? TYPE_MAP[tags.amenity === 'place_of_worship' ? 'church' : ''];
  if (type === undefined) {
    estimated = true;
    type = area < 35 ? BuildingType.Shed : BuildingType.Residential;
  }
  const timber = /timber/.test(tags['building:material'] ?? '') || /timber/.test(tags['building:architecture'] ?? '');
  if (timber) type = BuildingType.HalfTimbered;
  else if (type === BuildingType.Residential && ctx.coreFactor > 0 && hash01(id, 7) < 0.55 * ctx.coreFactor) {
    type = BuildingType.HalfTimbered;
    estimated = true;
  }

  let levels = num(tags['building:levels']);
  if (levels === null) {
    levels = defaultLevels(type, area, r);
    estimated = true;
  }
  levels = Math.max(1, Math.min(30, Math.round(levels)));

  let roof = ROOF_MAP[tags['roof:shape'] ?? ''];
  if (roof === undefined) {
    estimated = true;
    roof = ROOF[type];
    if (type === BuildingType.Residential && hash01(id, 3) < 0.25) roof = RoofShape.Hipped;
    // Sehr große Grundflächen sind fast immer flach (Hallen, Märkte)
    if (area > 1500 && type !== BuildingType.Church) roof = RoofShape.Flat;
  }

  const pitch = (PITCH[type] * Math.PI) / 180;
  let roofHeight = num(tags['roof:height']);
  if (roofHeight === null) {
    roofHeight =
      roof === RoofShape.Flat ? 0 : Math.min(9, halfShort * Math.tan(pitch) * (roof === RoofShape.Skillion ? 2 : 1));
    if (roof === RoofShape.Skillion) roofHeight = Math.min(roofHeight, 2.5);
  }

  const total = num(tags.height);
  const levelH =
    type === BuildingType.Industrial
      ? 4
      : type === BuildingType.Church
        ? 3.5
        : type === BuildingType.Garage || type === BuildingType.Shed
          ? 2.6
          : 2.9;
  let wallHeight = total !== null ? Math.max(2.2, total - roofHeight) : levels * levelH + (levels > 1 ? 0.4 : 0);
  if (type === BuildingType.Church && total === null) wallHeight = Math.max(wallHeight, 12);

  return { type, roof, levels, wallHeight: round(wallHeight), roofHeight: round(roofHeight), estimated };
}

const round = (v: number) => Math.round(v * 100) / 100;

/** Entfernt doppelte/fast doppelte Punkte und kollineare Mini-Zacken (< 5 cm). */
export function cleanRing(p: number[]): number[] {
  const out: number[] = [];
  const n = p.length / 2;
  for (let i = 0; i < n; i++) {
    const x = p[i * 2],
      z = p[i * 2 + 1];
    const k = out.length;
    if (k >= 2 && Math.hypot(out[k - 2] - x, out[k - 1] - z) < 0.05) continue;
    out.push(x, z);
  }
  if (out.length >= 4 && Math.hypot(out[0] - out[out.length - 2], out[1] - out[out.length - 1]) < 0.05) out.length -= 2;
  return out;
}

export interface PlacedBuilding {
  tx: number;
  tz: number;
  building: Building;
}

/** Ordnet Gebäude genau einer Kachel zu (Schwerpunkt) und rechnet in Kachel-lokale Koordinaten um. */
export function placeBuildings(
  raw: RawBuilding[],
  tileSize: number,
  coreFactorAt: (x: number, z: number) => number,
): PlacedBuilding[] {
  const out: PlacedBuilding[] = [];
  for (const rb of raw) {
    const ring = ensureCCW(cleanRing(rb.outline));
    if (ring.length < 6) continue;
    const area = Math.abs(signedArea(ring));
    if (area < 4) continue; // Mini-Objekte (Trafo-Kästen o. ä.) ignorieren
    const [cx, cz] = centroid(ring);
    const tx = Math.floor(cx / tileSize),
      tz = Math.floor(cz / tileSize);
    const obb = orientedRect(ring);
    const cls = classifyBuilding(rb.id, rb.tags, area, obb.halfShort, { coreFactor: coreFactorAt(cx, cz) });
    const ox = tx * tileSize,
      oz = tz * tileSize;
    const local = new Float32Array(ring.length);
    for (let i = 0; i < ring.length; i += 2) {
      local[i] = ring[i] - ox;
      local[i + 1] = ring[i + 1] - oz;
    }
    out.push({ tx, tz, building: { id: rb.id, outline: local, ...cls } });
  }
  out.sort((a, b) => a.building.id - b.building.id);
  return out;
}
