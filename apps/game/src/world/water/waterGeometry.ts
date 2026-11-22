import earcut from 'earcut';
import { LandKind, sampleHeight, type TileData } from '@kandern/world-format';
import { GeoBuilder, type GeometryBuffers } from '../gen/GeoBuilder.ts';
import { Marking, RoadCode, type RoadProfile } from '../roads/profile.ts';
import { extrudeRibbon } from '../roads/ribbon.ts';

/** Wasser liegt knapp über dem Gelände (Flächen etwas tiefer als Bänder, damit Bänder oben liegen). */
export const RIVER_LIFT = 0.06;
export const LAKE_LIFT = 0.08;
/** Wasserflächen werden auf diese Kantenlänge unterteilt, damit sie dem Gelände folgen (m). */
export const MAX_EDGE = 3;
const WHITE: [number, number, number] = [1, 1, 1];

type P = [number, number];

/** Abstand der Nachbarproben für die Wasserhöhe (m). */
export const BED_RADIUS = 4;

/**
 * Wasserhöhe einer Fläche: tiefster Geländepunkt in der Umgebung. So liegt das Wasser im Flussbett,
 * statt sich mit der Uferböschung zu wölben; am Ufer verschwindet es unter dem Gelände.
 */
export function bedHeight(ground: (x: number, z: number) => number, x: number, z: number): number {
  const r = BED_RADIUS;
  return Math.min(ground(x, z), ground(x + r, z), ground(x - r, z), ground(x, z + r), ground(x, z - r));
}

/** Teilt ein Dreieck rekursiv an der längsten Kante, bis alle Kanten ≤ MAX_EDGE sind. */
export function subdivide(a: P, b: P, c: P, emit: (a: P, b: P, c: P) => void, depth = 0): void {
  const ab = Math.hypot(b[0] - a[0], b[1] - a[1]),
    bc = Math.hypot(c[0] - b[0], c[1] - b[1]),
    ca = Math.hypot(a[0] - c[0], a[1] - c[1]);
  const longest = Math.max(ab, bc, ca);
  if (longest <= MAX_EDGE || depth > 14) {
    emit(a, b, c);
    return;
  }
  const mid = (p: P, q: P): P => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  if (longest === ab) {
    const m = mid(a, b);
    subdivide(a, m, c, emit, depth + 1);
    subdivide(m, b, c, emit, depth + 1);
  } else if (longest === bc) {
    const m = mid(b, c);
    subdivide(a, b, m, emit, depth + 1);
    subdivide(a, m, c, emit, depth + 1);
  } else {
    const m = mid(c, a);
    subdivide(a, b, m, emit, depth + 1);
    subdivide(m, b, c, emit, depth + 1);
  }
}

const flatProfile = (width: number): RoadProfile => ({
  segments: [{ a: { c: -width / 2, h: 0 }, b: { c: width / 2, h: 0 }, code: RoadCode.Water }],
  halfCarriageway: width / 2,
  marking: Marking.None,
  lanes: 0,
  totalWidth: width,
});

/**
 * Wasser einer Kachel als ein Mesh: Gewässerbänder (uv = Querlage, Länge in Fließrichtung; uv2 = (halbe Breite, 1))
 * und Wasserflächen per earcut (uv = Kachelposition; uv2 = (0, 0) = stehend, ohne Ufer).
 */
export function buildWaterGeometry(tile: TileData): GeometryBuffers | null {
  const g = new GeoBuilder(true);
  const lod = tile.lods[0];
  const ground = (x: number, z: number) =>
    sampleHeight(tile, lod, Math.min(tile.size, Math.max(0, x)), Math.min(tile.size, Math.max(0, z)));
  for (const a of tile.land) {
    if (a.kind !== LandKind.Water) continue;
    const flat: number[] = [];
    const holes: number[] = [];
    a.rings.forEach((r, i) => {
      if (i > 0) holes.push(flat.length / 2);
      for (const v of r) flat.push(v);
    });
    const tris = earcut(flat, holes);
    const v = (k: number): [number, number, number] => [
      flat[k * 2],
      ground(flat[k * 2], flat[k * 2 + 1]) + LAKE_LIFT,
      flat[k * 2 + 1],
    ];
    const uv = (k: number): [number, number] => [flat[k * 2], flat[k * 2 + 1]];
    for (let t = 0; t < tris.length; t += 3) {
      const [i, j, k] = [tris[t], tris[t + 1], tris[t + 2]];
      g.tri(v(i), v(j), v(k), [0, 1, 0], [WHITE, WHITE, WHITE], [uv(i), uv(j), uv(k)], [0, 0]);
    }
  }
  for (const w of tile.waterways) {
    const width = Math.max(1, w.width);
    extrudeRibbon(g, {
      points: w.points,
      profile: flatProfile(width),
      trimStart: 0,
      trimEnd: 0,
      ground: (x, z) => bedHeight(ground, x, z),
      follow: 'min',
      deckStart: NaN,
      deckEnd: NaN,
      lift: RIVER_LIFT,
      uv2: [width / 2, 1],
    });
  }
  return g.build();
}
