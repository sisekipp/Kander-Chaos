import earcut from 'earcut';
import type { Crossing, Junction } from '@kandern/world-format';
import type { GeoBuilder } from '../gen/GeoBuilder.ts';
import { RoadCode } from './profile.ts';
import { ROAD_LIFT } from './ribbon.ts';

type V3 = [number, number, number];
const WHITE: [number, number, number] = [1, 1, 1];
const UP: V3 = [0, 1, 0];
/** Breite eines Zebrastreifens in Fahrtrichtung (m) und Höhe über der Fahrbahn gegen Z-Fighting. */
export const ZEBRA_WIDTH = 3;
const ZEBRA_LIFT = 0.02;

type Ground = (x: number, z: number) => number;

/**
 * Kreuzungsfläche per earcut, Code „Kreuzung“ (Asphalt ohne Markierung). Höhe je Ecke:
 * Maximum aus Gelände an der Ecke und am Knoten, damit die Fläche nicht unter die Arme sinkt.
 */
export function addJunction(g: GeoBuilder, j: Junction, ground: Ground): number {
  const ring = j.ring;
  const n = ring.length / 2;
  if (n < 3) return 0;
  let cx = 0,
    cz = 0;
  for (let i = 0; i < n; i++) {
    cx += ring[i * 2];
    cz += ring[i * 2 + 1];
  }
  const hc = ground(cx / n, cz / n);
  const tris = earcut(Array.from(ring));
  const v = (k: number): V3 => {
    const x = ring[k * 2],
      z = ring[k * 2 + 1];
    return [x, Math.max(ground(x, z), hc) + ROAD_LIFT, z];
  };
  const uv = (k: number): [number, number] => [ring[k * 2], ring[k * 2 + 1]];
  for (let t = 0; t < tris.length; t += 3) {
    const [a, b, c] = [tris[t], tris[t + 1], tris[t + 2]];
    g.tri(v(a), v(b), v(c), UP, [WHITE, WHITE, WHITE], [uv(a), uv(b), uv(c)], [RoadCode.Junction, 0]);
  }
  return tris.length / 3;
}

/**
 * Zebrastreifen als Rechteck über die Fahrbahn: Länge = Fahrbahnbreite (in Laufrichtung),
 * Breite ZEBRA_WIDTH (in Fahrtrichtung). uv.x läuft in Laufrichtung (Streifen im Shader), uv.y quer dazu.
 */
export function addCrossing(g: GeoBuilder, c: Crossing, ground: Ground): void {
  const hl = c.length / 2,
    hw = ZEBRA_WIDTH / 2;
  const wx = c.dirX,
    wz = c.dirZ; // Laufrichtung
  const rx = -wz,
    rz = wx; // Fahrtrichtung
  const y =
    Math.max(ground(c.x, c.z), ground(c.x + wx * hl, c.z + wz * hl), ground(c.x - wx * hl, c.z - wz * hl)) +
    ROAD_LIFT +
    ZEBRA_LIFT;
  const p = (a: number, b: number): V3 => [c.x + wx * a + rx * b, y, c.z + wz * a + rz * b];
  g.quad(
    p(-hl, -hw),
    p(hl, -hw),
    p(hl, hw),
    p(-hl, hw),
    UP,
    [WHITE, WHITE, WHITE, WHITE],
    [
      [-hl, -hw],
      [hl, -hw],
      [hl, hw],
      [-hl, hw],
    ],
    [RoadCode.Zebra, 0],
  );
}
