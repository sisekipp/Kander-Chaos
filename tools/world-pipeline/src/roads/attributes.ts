import { LandKind, RoadKind, Surface, pointInRing } from '@kandern/world-format';

/** Gleisanzahl aus `tracks` (1 … 8, Standard 1). */
export function trackCount(tags: Record<string, string>): number {
  const t = parseInt(tags.tracks ?? '', 10);
  return Number.isFinite(t) && t > 0 && t <= 8 ? t : 1;
}

/** Darstellungsattribute einer Straße aus OSM-Tags plus Ergänzungsregeln. */
export interface RoadAttributes {
  lanes: number;
  oneway: boolean;
  sidewalkLeft: boolean;
  sidewalkRight: boolean;
  surface: Surface;
  layer: number;
  /** Teil eines Kreisverkehrs (`junction=roundabout|circular`). */
  roundabout: boolean;
}

/** Straßenarten mit Fahrbahn für Kraftfahrzeuge. */
const CARRIAGEWAY = new Set([
  RoadKind.Motorway,
  RoadKind.Primary,
  RoadKind.Secondary,
  RoadKind.Tertiary,
  RoadKind.Residential,
  RoadKind.Service,
]);

/** Straßenarten, die im Ort ohne Angabe beidseitig einen Gehweg bekommen. */
const SIDEWALK_IN_TOWN = new Set([RoadKind.Primary, RoadKind.Secondary, RoadKind.Tertiary, RoadKind.Residential]);

const SURFACE: Record<string, Surface> = {
  asphalt: Surface.Asphalt,
  paved: Surface.Asphalt,
  chipseal: Surface.Asphalt,
  paving_stones: Surface.Paving,
  sett: Surface.Paving,
  cobblestone: Surface.Paving,
  unhewn_cobblestone: Surface.Paving,
  bricks: Surface.Paving,
  concrete: Surface.Concrete,
  'concrete:plates': Surface.Concrete,
  'concrete:lanes': Surface.Concrete,
  gravel: Surface.Gravel,
  fine_gravel: Surface.Gravel,
  compacted: Surface.Gravel,
  pebblestone: Surface.Gravel,
  unpaved: Surface.Dirt,
  dirt: Surface.Dirt,
  ground: Surface.Dirt,
  earth: Surface.Dirt,
  mud: Surface.Dirt,
  sand: Surface.Dirt,
  grass: Surface.Grass,
  grass_paver: Surface.Grass,
};

const TRACKTYPE: Record<string, Surface> = {
  grade1: Surface.Asphalt,
  grade2: Surface.Gravel,
  grade3: Surface.Gravel,
  grade4: Surface.Dirt,
  grade5: Surface.Grass,
};

const yes = (v: string | undefined) => v === 'yes' || v === 'true' || v === '1';
/** Gehweg wird nur gezeichnet, wenn er Teil der Straße ist („separate“ = eigener Weg in OSM). */
const drawn = (v: string | undefined) => v === 'yes';

function defaultLanes(kind: RoadKind, oneway: boolean): number {
  if (kind === RoadKind.Motorway) return oneway ? 2 : 4;
  if (kind === RoadKind.Service) return 1;
  if (CARRIAGEWAY.has(kind)) return oneway ? 1 : 2;
  return 0;
}

function defaultSurface(kind: RoadKind, inSettlement: boolean): Surface {
  switch (kind) {
    case RoadKind.Track:
      return Surface.Gravel;
    case RoadKind.Path:
      return inSettlement ? Surface.Gravel : Surface.Dirt;
    case RoadKind.Footway:
    case RoadKind.Steps:
      return inSettlement ? Surface.Paving : Surface.Gravel;
    case RoadKind.Rail:
      return Surface.Gravel;
    default:
      return Surface.Asphalt;
  }
}

function sidewalks(tags: Record<string, string>, kind: RoadKind, inSettlement: boolean): [boolean, boolean] {
  const s = tags.sidewalk;
  const both = tags['sidewalk:both'];
  const l = tags['sidewalk:left'];
  const r = tags['sidewalk:right'];
  if (s !== undefined || both !== undefined || l !== undefined || r !== undefined) {
    if (s === 'both' || drawn(both)) return [true, true];
    return [s === 'left' || drawn(l), s === 'right' || drawn(r)];
  }
  // Ergänzungsregel: im Ort haben Straßen fast immer Gehwege, in OSM fehlen sie aber oft.
  if (inSettlement && SIDEWALK_IN_TOWN.has(kind) && tags.highway !== 'living_street') return [true, true];
  return [false, false];
}

export function roadAttributes(tags: Record<string, string>, kind: RoadKind, inSettlement: boolean): RoadAttributes {
  const oneway =
    yes(tags.oneway) ||
    tags.oneway === '-1' ||
    tags.junction === 'roundabout' ||
    (kind === RoadKind.Motorway && tags.oneway !== 'no');
  const lanesTag = parseInt(tags.lanes ?? '', 10);
  // Bei Bahnstrecken steht die Gleisanzahl im Feld der Fahrstreifen
  const lanes = CARRIAGEWAY.has(kind)
    ? Number.isFinite(lanesTag) && lanesTag > 0 && lanesTag < 10
      ? lanesTag
      : defaultLanes(kind, oneway)
    : kind === RoadKind.Rail
      ? trackCount(tags)
      : 0;
  const [sidewalkLeft, sidewalkRight] = CARRIAGEWAY.has(kind) ? sidewalks(tags, kind, inSettlement) : [false, false];
  const surface =
    SURFACE[tags.surface ?? ''] ??
    (kind === RoadKind.Track ? TRACKTYPE[tags.tracktype ?? ''] : undefined) ??
    defaultSurface(kind, inSettlement);
  const layerTag = parseInt(tags.layer ?? '', 10);
  const layer = Number.isFinite(layerTag)
    ? Math.max(-5, Math.min(5, layerTag))
    : yes(tags.bridge) || (tags.bridge !== undefined && tags.bridge !== 'no')
      ? 1
      : tags.tunnel !== undefined && tags.tunnel !== 'no'
        ? -1
        : 0;
  const roundabout = tags.junction === 'roundabout' || tags.junction === 'circular';
  return { lanes, oneway, sidewalkLeft, sidewalkRight, surface, layer, roundabout };
}

const SETTLEMENT = new Set([LandKind.Residential, LandKind.Commercial, LandKind.Industrial]);

interface SettlementArea {
  kind: LandKind;
  outers: number[][];
}

/** Prüffunktion „liegt im Ort“ aus Siedlungsflächen (Wohn-, Gewerbe-, Industriegebiet), mit Begrenzungsrahmen. */
export function settlementLookup(areas: SettlementArea[]): (x: number, z: number) => boolean {
  const rings: { ring: number[]; minX: number; minZ: number; maxX: number; maxZ: number }[] = [];
  for (const a of areas) {
    if (!SETTLEMENT.has(a.kind)) continue;
    for (const ring of a.outers) {
      let minX = Infinity,
        minZ = Infinity,
        maxX = -Infinity,
        maxZ = -Infinity;
      for (let i = 0; i < ring.length; i += 2) {
        minX = Math.min(minX, ring[i]);
        maxX = Math.max(maxX, ring[i]);
        minZ = Math.min(minZ, ring[i + 1]);
        maxZ = Math.max(maxZ, ring[i + 1]);
      }
      rings.push({ ring, minX, minZ, maxX, maxZ });
    }
  }
  return (x, z) =>
    rings.some((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ && pointInRing(x, z, r.ring));
}
