import { LandKind } from '@kandern/world-format';
import { DEFAULT_GROUND, LAND_COLORS, type RGB } from '../gen/palette.ts';

/** Abstand der Nachbarproben für weiche Übergänge (m). */
export const BLEND_RADIUS = 4;

/** Minimale Sicht auf die Landnutzung einer Kachel (siehe `LandLookup`). */
export interface LandQuery {
  areaAt(x: number, z: number): number;
  kindOf(area: number): LandKind;
  outerRing(area: number): Float32Array;
}

/** Ergebnis je Vertex: gemischte Grundfarbe und Gewichte der Bodenmuster (0 … 1). */
export interface LandSample {
  color: RGB;
  /** Acker-Furchen (nur innerhalb desselben Feldes, fällt an Feldrändern ab). */
  farm: number;
  forest: number;
  settlement: number;
  /** Furchenrichtung in rad (0 … π), Richtung der längsten echten Feldkante. */
  angle: number;
}

const FOREST = new Set([LandKind.ForestDeciduous, LandKind.ForestConiferous, LandKind.ForestMixed]);
const SETTLEMENT = new Set([LandKind.Residential, LandKind.Commercial, LandKind.Industrial]);
/**
 * Mitte plus acht Proben auf einem Kreis, um 22,5° gedreht: Jede Probe hat eine eigene x- und z-Lage,
 * an Grenzen kippt also immer nur eine Probe. Der Übergang erstreckt sich über ~8 m (4 Rasterpunkte),
 * sonst zeigen sich am 2-m-Geländeraster Treppenstufen in den Mustern.
 */
const OFFSETS: [number, number][] = [
  [0, 0],
  ...Array.from({ length: 8 }, (_, k): [number, number] => {
    const a = ((k + 0.25) / 8) * Math.PI * 2;
    return [Math.cos(a) * BLEND_RADIUS, Math.sin(a) * BLEND_RADIUS];
  }),
];

/**
 * Richtung der längsten Kante eines Feldes, die nicht auf dem Kachelrand liegt. Zugeschnittene
 * Teile desselben Feldes in Nachbarkacheln behalten so dieselbe Furchenrichtung.
 */
export function fieldAngle(ring: ArrayLike<number>, tileSize: number): number {
  const n = ring.length / 2;
  const onEdge = (v: number) => Math.abs(v) < 0.01 || Math.abs(v - tileSize) < 0.01;
  let best = -1,
    angle = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const x0 = ring[i * 2],
      z0 = ring[i * 2 + 1],
      x1 = ring[j * 2],
      z1 = ring[j * 2 + 1];
    const border =
      (onEdge(x0) && onEdge(x1) && Math.abs(x0 - x1) < 0.01) || (onEdge(z0) && onEdge(z1) && Math.abs(z0 - z1) < 0.01);
    if (border) continue;
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len > best) {
      best = len;
      angle = Math.atan2(z1 - z0, x1 - x0);
    }
  }
  if (angle < 0) angle += Math.PI;
  return angle >= Math.PI ? angle - Math.PI : angle;
}

const colorOf = (land: LandQuery, area: number): RGB => (area < 0 ? DEFAULT_GROUND : LAND_COLORS[land.kindOf(area)]);

/**
 * Mischt Landnutzung und Musterwerte aus neun Proben um (x, z). Das Furchengewicht ist der Anteil der
 * Proben im häufigsten Acker der Umgebung – auch knapp außerhalb des Feldes > 0, damit es über die
 * Feldkante stetig verläuft (der Shader schärft es bei 0,5 auf die Kante). `angles` cacht Feldrichtungen.
 */
export function sampleLand(
  land: LandQuery,
  x: number,
  z: number,
  tileSize: number,
  angles: Map<number, number>,
): LandSample {
  const color: RGB = [0, 0, 0];
  const farmCounts = new Map<number, number>();
  let forest = 0,
    settlement = 0;
  for (const [dx, dz] of OFFSETS) {
    const a = land.areaAt(x + dx, z + dz);
    const c = colorOf(land, a);
    color[0] += c[0] / OFFSETS.length;
    color[1] += c[1] / OFFSETS.length;
    color[2] += c[2] / OFFSETS.length;
    const k = a < 0 ? null : land.kindOf(a);
    if (k === LandKind.Farmland) farmCounts.set(a, (farmCounts.get(a) ?? 0) + 1);
    if (k !== null && FOREST.has(k)) forest++;
    if (k !== null && SETTLEMENT.has(k)) settlement++;
  }
  let field = -1,
    best = 0;
  for (const [a, n] of farmCounts)
    if (n > best || (n === best && a < field)) {
      best = n;
      field = a;
    }
  let angle = 0;
  if (field >= 0) {
    let a = angles.get(field);
    if (a === undefined) angles.set(field, (a = fieldAngle(land.outerRing(field), tileSize)));
    angle = a;
  }
  return {
    color,
    farm: best / OFFSETS.length,
    forest: forest / OFFSETS.length,
    settlement: settlement / OFFSETS.length,
    angle,
  };
}
