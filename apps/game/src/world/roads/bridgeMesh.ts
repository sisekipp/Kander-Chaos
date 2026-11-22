import type { GeoBuilder } from '../gen/GeoBuilder.ts';
import { RoadCode } from './profile.ts';
import { polylineLength } from './ribbon.ts';

type V3 = [number, number, number];
const WHITE: [number, number, number] = [1, 1, 1];

/** Pfeilerabstand (m) und Mindesthöhe der Fahrbahn über dem Gelände, ab der Pfeiler stehen. */
export const PIER_SPACING = 15;
export const PIER_MIN_CLEARANCE = 3;
const PIER_DEPTH = 1.2;
const DECK_THICKNESS = 0.6;
/** Synthetische Knoten-IDs an Kachelschnitten (siehe Pipeline `cutNodeId`) – dort kein Tunnelportal. */
const CUT_NODE_BASE = 4e15;

export interface PierSpot {
  x: number;
  z: number;
  /** Fahrtrichtung (normiert). */
  dx: number;
  dz: number;
  ground: number;
  deck: number;
}

/**
 * Pfeilerpositionen alle PIER_SPACING m entlang der Brücke (mittig verteilt), nur wo die Fahrbahn
 * mehr als PIER_MIN_CLEARANCE über dem Gelände liegt.
 */
export function pierSpots(
  points: ArrayLike<number>,
  deckStart: number,
  deckEnd: number,
  ground: (x: number, z: number) => number,
): PierSpot[] {
  const L = polylineLength(points);
  const count = Math.floor(L / PIER_SPACING);
  if (count < 1) return [];
  const first = (L - (count - 1) * PIER_SPACING) / 2;
  const out: PierSpot[] = [];
  let k = 0,
    acc = 0;
  for (let i = 2; i < points.length && k < count; i += 2) {
    const x0 = points[i - 2],
      z0 = points[i - 1];
    const len = Math.hypot(points[i] - x0, points[i + 1] - z0);
    while (k < count && first + k * PIER_SPACING <= acc + len) {
      const s = first + k * PIER_SPACING;
      const t = len > 0 ? (s - acc) / len : 0;
      const dx = (points[i] - x0) / (len || 1),
        dz = (points[i + 1] - z0) / (len || 1);
      const x = x0 + dx * len * t,
        z = z0 + dz * len * t;
      const deck = deckStart + ((deckEnd - deckStart) * s) / L;
      const g = ground(x, z);
      if (deck - g > PIER_MIN_CLEARANCE) out.push({ x, z, dx, dz, ground: g, deck });
      k++;
    }
    acc += len;
  }
  return out;
}

/** Quader aus Mitte, Achsen (Fahrtrichtung u, quer v) und halben Maßen; oben bei `top`, unten bei `bottom`. */
export function addBox(
  g: GeoBuilder,
  cx: number,
  cz: number,
  ux: number,
  uz: number,
  halfU: number,
  halfV: number,
  bottom: number,
  top: number,
  code: RoadCode,
): void {
  const vx = uz,
    vz = -ux;
  const p = (a: number, b: number, y: number): V3 => [cx + ux * a + vx * b, y, cz + uz * a + vz * b];
  const uv2: [number, number] = [code, 0];
  const face = (a: V3, b: V3, c: V3, d: V3, out: V3) =>
    g.quad(
      a,
      b,
      c,
      d,
      out,
      [WHITE, WHITE, WHITE, WHITE],
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      uv2,
    );
  const [A, B, C, D] = [
    p(-halfU, -halfV, bottom),
    p(halfU, -halfV, bottom),
    p(halfU, halfV, bottom),
    p(-halfU, halfV, bottom),
  ];
  const [E, F, G, H] = [p(-halfU, -halfV, top), p(halfU, -halfV, top), p(halfU, halfV, top), p(-halfU, halfV, top)];
  face(E, F, G, H, [0, 1, 0]);
  face(A, B, F, E, [-vx, 0, -vz]);
  face(C, D, H, G, [vx, 0, vz]);
  face(B, C, G, F, [ux, 0, uz]);
  face(D, A, E, H, [-ux, 0, -uz]);
}

/** Pfeiler unter einer Brücke (Breite quer = 60 % der Fahrbahnbreite). */
export function addPiers(g: GeoBuilder, spots: PierSpot[], roadWidth: number): void {
  for (const s of spots)
    addBox(
      g,
      s.x,
      s.z,
      s.dx,
      s.dz,
      PIER_DEPTH / 2,
      roadWidth * 0.3,
      s.ground - 1,
      s.deck - DECK_THICKNESS,
      RoadCode.Concrete,
    );
}

/** Tunnelportal (zwei Pfeiler + Sturz) quer zur Fahrbahn an einem Tunnelende. */
export function addTunnelPortal(
  g: GeoBuilder,
  x: number,
  z: number,
  dx: number,
  dz: number,
  width: number,
  groundY: number,
): void {
  const half = width / 2 + 0.6;
  const vx = dz,
    vz = -dx;
  const clear = 4.6;
  for (const side of [-1, 1])
    addBox(
      g,
      x + vx * side * half,
      z + vz * side * half,
      dx,
      dz,
      0.5,
      0.6,
      groundY - 0.5,
      groundY + clear + 1.2,
      RoadCode.Concrete,
    );
  addBox(g, x, z, dx, dz, 0.5, half + 0.6, groundY + clear, groundY + clear + 1.2, RoadCode.Concrete);
}

/** Tunnelenden einer Kachel-Straße, die keine Kachelschnitte sind (dort steht ein Portal). */
export function tunnelEnds(
  points: ArrayLike<number>,
  startNode: number,
  endNode: number,
): { x: number; z: number; dx: number; dz: number }[] {
  const n = points.length;
  const out: { x: number; z: number; dx: number; dz: number }[] = [];
  const dir = (ax: number, az: number, bx: number, bz: number) => {
    const l = Math.hypot(bx - ax, bz - az) || 1;
    return [(bx - ax) / l, (bz - az) / l];
  };
  if (startNode < CUT_NODE_BASE) {
    const [dx, dz] = dir(points[0], points[1], points[2], points[3]);
    out.push({ x: points[0], z: points[1], dx, dz });
  }
  if (endNode < CUT_NODE_BASE) {
    const [dx, dz] = dir(points[n - 4], points[n - 3], points[n - 2], points[n - 1]);
    out.push({ x: points[n - 2], z: points[n - 1], dx, dz });
  }
  return out;
}
