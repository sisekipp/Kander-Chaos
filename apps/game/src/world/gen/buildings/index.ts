import {
  BuildingType,
  RoofShape,
  orientedRect,
  sampleHeight,
  type Building,
  type ChurchTower,
  type Road,
  type TileData,
} from '@kandern/world-format';
import { GeoBuilder, type GeometryBuffers } from '../GeoBuilder.ts';
import { FACADE_OF, Facade, ROOF_COLORS, WALL_COLORS, idRandom, pick, type RGB } from '../palette.ts';
import { addPitchedRoof } from './roofs.ts';
import { addWalls, flatCap, shade, type V3 } from './walls.ts';
import { buildingDetails } from './details.ts';
import { addChurchTower, naveRoofHeight, towerHeight } from './church.ts';

export interface BuildingGenOptions {
  /** true = vereinfachte Blöcke für Ring 1 (flache Kappe, keine Dachform). */
  simple: boolean;
}

function roofColor(b: Building): RGB {
  const r = idRandom(b.id, 5);
  if (b.roof === RoofShape.Flat) return pick(ROOF_COLORS.flat, r);
  if (b.type === BuildingType.Industrial || b.type === BuildingType.Garage) return pick(ROOF_COLORS.metal, r);
  if (b.type === BuildingType.Church || r < 0.12) return pick(ROOF_COLORS.dark, r);
  return pick(ROOF_COLORS.tile, r);
}

/**
 * Erzeugt alle Gebäude einer Kachel als ein Mesh (Kachel-lokal). Wände folgen dem echten Grundriss;
 * Sattel-, Walm-, Zelt- und Pultdächer werden über dem orientierten Rechteck gebaut, wenn der
 * Grundriss annähernd rechteckig ist (Füllgrad ≥ 0,8), sonst Flachdach.
 */
export function buildBuildings(tile: TileData, opts: BuildingGenOptions): GeometryBuffers | null {
  const g = new GeoBuilder(true);
  const lod = tile.lods[0];
  const ground = (x: number, z: number) =>
    sampleHeight(tile, lod, Math.min(tile.size, Math.max(0, x)), Math.min(tile.size, Math.max(0, z)));
  const towers = new Map((tile.details?.churchTowers ?? []).map((t) => [t.buildingId, t]));
  for (const b of tile.buildings) addBuilding(g, b, ground, opts, tile.roads, towers.get(b.id));
  return g.build();
}

export function addBuilding(
  g: GeoBuilder,
  b: Building,
  ground: (x: number, z: number) => number,
  opts: BuildingGenOptions,
  roads: Road[] = [],
  tower?: ChurchTower,
): void {
  const o = b.outline;
  const n = o.length / 2;
  if (n < 3) return;
  let gMin = Infinity;
  for (let i = 0; i < n; i++) gMin = Math.min(gMin, ground(o[i * 2], o[i * 2 + 1]));
  const base = gMin - 0.6; // leicht eingesunken -> kein Schweben am Hang
  const top = gMin + b.wallHeight;
  const wall = pick(WALL_COLORS[b.type], idRandom(b.id, 1));
  const facade = opts.simple ? Facade.Plain : FACADE_OF[b.type];
  const levelH = b.wallHeight / Math.max(1, b.levels);
  const det = opts.simple ? null : buildingDetails(b, roads);
  // Ladenfarbe im Fassadencode (Fassade + 100 · Farbe), Shader dekodiert
  const uv2: [number, number] = [facade + 100 * (det?.shutters ?? 0), levelH];
  const bottomCol = shade(wall, 0.62); // eingebackene Umgebungsverdeckung am Boden
  const topCol = wall;

  addWalls(g, o, base, top, gMin, bottomCol, topCol, uv2);
  if (det?.doorWall != null) addDoor(g, o, det.doorWall, ground);

  const rc = roofColor(b);
  const obb = orientedRect(o);
  if (tower && !opts.simple && b.type === BuildingType.Church) {
    // Kirche: steiles Satteldach (55°) über dem Schiff, Turm mit Spitzhelm an der Turmlage der Kacheldaten
    const roofHeight = naveRoofHeight(obb.halfShort, b.roofHeight);
    if (obb.fill >= 0.6) addPitchedRoof(g, { ...b, roof: RoofShape.Gabled, roofHeight }, obb, top, rc, wall, levelH);
    else flatCap(g, o, top, rc, null, wall, levelH);
    addChurchTower(g, tower, gMin, towerHeight(b.wallHeight, b.wallHeight + roofHeight));
    return;
  }
  const pitched = !opts.simple && b.roof !== RoofShape.Flat && b.roofHeight > 0.2 && obb.fill >= 0.8;
  if (!pitched) {
    flatCap(
      g,
      o,
      opts.simple ? top + b.roofHeight * 0.4 : top,
      b.roof === RoofShape.Flat || opts.simple ? rc : shade(rc, 0.8),
      opts.simple ? top : null,
      wall,
      levelH,
    );
    return;
  }
  addPitchedRoof(g, b, obb, top, rc, wall, levelH, det?.chimney ?? null);
}

const DOOR_WIDTH = 1.1;
const DOOR_HEIGHT = 2.15;
const WHITE: RGB = [1, 1, 1];

/** Haustür als Fläche 3 cm vor der Wandmitte (Fassadencode Tür, uv 0 … 1 für Rahmen und Füllung). */
function addDoor(g: GeoBuilder, o: Float32Array, wall: number, ground: (x: number, z: number) => number): void {
  const n = o.length / 2;
  const j = (wall + 1) % n;
  const x0 = o[wall * 2],
    z0 = o[wall * 2 + 1],
    x1 = o[j * 2],
    z1 = o[j * 2 + 1];
  const len = Math.hypot(x1 - x0, z1 - z0);
  const tx = (x1 - x0) / len,
    tz = (z1 - z0) / len;
  const out: V3 = [tz, 0, -tx];
  const mx = (x0 + x1) / 2 + out[0] * 0.03,
    mz = (z0 + z1) / 2 + out[2] * 0.03;
  const y0 = ground((x0 + x1) / 2, (z0 + z1) / 2);
  const h = DOOR_WIDTH / 2;
  g.quad(
    [mx - tx * h, y0, mz - tz * h],
    [mx + tx * h, y0, mz + tz * h],
    [mx + tx * h, y0 + DOOR_HEIGHT, mz + tz * h],
    [mx - tx * h, y0 + DOOR_HEIGHT, mz - tz * h],
    out,
    [WHITE, WHITE, WHITE, WHITE],
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    [Facade.Door, 0],
  );
}
