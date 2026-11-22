import { RoadKind, signedArea } from '@kandern/world-format';
import type { WayPiece } from './network.ts';

/** Gehwegbreite je Seite in m (wie im Straßenquerschnitt des Spiels). */
export const SIDEWALK_WIDTH = 2;
/** Arme mit kleinerem Winkelabstand gelten als fast parallel -> Rückfall. */
const MIN_GAP = (15 * Math.PI) / 180;
/** Ab diesem Winkelabstand liegt zwischen zwei Armen keine Ecke (durchgehende Straßenkante). */
const STRAIGHT_GAP = (160 * Math.PI) / 180;
/** Längere Kürzungen deuten auf unsaubere Geometrie hin -> Rückfall. */
const MAX_TRIM = 40;
/** Ein Arm darf höchstens um diesen Anteil seiner Länge gekürzt werden. */
const MAX_TRIM_SHARE = 0.45;

export interface JunctionShape {
  node: number;
  x: number;
  z: number;
  /** Ring CCW in Weltkoordinaten. */
  ring: number[];
  fallback: boolean;
}

export interface PieceTrim {
  start: number;
  end: number;
}

interface Arm {
  piece: WayPiece;
  atStart: boolean;
  dx: number;
  dz: number;
  angle: number;
  /** Abstand der linken/rechten Außenkante (inkl. Gehweg) von der Mitte, in Blickrichtung vom Knoten weg. */
  left: number;
  right: number;
  length: number;
}

const isJunctionKind = (k: RoadKind) => k <= RoadKind.Track;

function polylineLength(c: number[]): number {
  let l = 0;
  for (let i = 2; i < c.length; i += 2) l += Math.hypot(c[i] - c[i - 2], c[i + 1] - c[i - 1]);
  return l;
}

/** Richtung vom Knoten zu einem Punkt ~6 m entlang des Arms (robust gegen Knicke direkt am Knoten). */
function armDirection(c: number[], atStart: boolean): [number, number] {
  const n = c.length / 2;
  const at = (i: number) => (atStart ? i : n - 1 - i);
  const x0 = c[at(0) * 2],
    z0 = c[at(0) * 2 + 1];
  let px = x0,
    pz = z0;
  for (let i = 1; i < n; i++) {
    px = c[at(i) * 2];
    pz = c[at(i) * 2 + 1];
    if (Math.hypot(px - x0, pz - z0) >= 6) break;
  }
  const l = Math.hypot(px - x0, pz - z0) || 1;
  return [(px - x0) / l, (pz - z0) / l];
}

function makeArm(piece: WayPiece, atStart: boolean): Arm {
  const [dx, dz] = armDirection(piece.coords, atStart);
  const half = piece.width / 2;
  const swL = piece.attrs.sidewalkLeft ? SIDEWALK_WIDTH : 0;
  const swR = piece.attrs.sidewalkRight ? SIDEWALK_WIDTH : 0;
  // Am Ende des Stücks blickt man entgegen der Wegrichtung: links und rechts tauschen.
  return {
    piece,
    atStart,
    dx,
    dz,
    angle: Math.atan2(dz, dx),
    left: half + (atStart ? swL : swR),
    right: half + (atStart ? swR : swL),
    length: polylineLength(piece.coords),
  };
}

const cross = (ax: number, az: number, bx: number, bz: number) => ax * bz - az * bx;

/** Schnitt linke Kante von a mit rechter Kante von b; liefert Abstände entlang a und b oder null. */
function corner(a: Arm, b: Arm): [number, number] | null {
  // Linke Normale (CCW) von a: (-dz, dx)
  const wx = b.dz * b.right - -a.dz * a.left;
  const wz = -b.dx * b.right - a.dx * a.left;
  const det = cross(a.dx, a.dz, -b.dx, -b.dz);
  if (Math.abs(det) < 1e-6) return null;
  const t = cross(wx, wz, -b.dx, -b.dz) / det;
  const s = cross(a.dx, a.dz, wx, wz) / det;
  return [Math.max(0, t), Math.max(0, s)];
}

function edgePoint(nx: number, nz: number, a: Arm, t: number, side: 1 | -1): [number, number] {
  const off = side === 1 ? a.left : -a.right;
  return [nx + a.dx * t - a.dz * off, nz + a.dz * t + a.dx * off];
}

function circle(nx: number, nz: number, r: number): number[] {
  const ring: number[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ring.push(nx + Math.cos(a) * r, nz + Math.sin(a) * r);
  }
  return ring;
}

/** Kreuzungsform eines Knotens nach dem Verfahren von A/B Street; null = Rückfall nötig. */
function shapeOf(nx: number, nz: number, arms: Arm[]): { ring: number[]; trims: number[] } | null {
  const k = arms.length;
  const trims = arms.map((a) => Math.min(a.left, a.right) * 0.5);
  const corners: ([number, number] | null)[] = [];
  for (let i = 0; i < k; i++) {
    const a = arms[i],
      b = arms[(i + 1) % k];
    let gap = b.angle - a.angle;
    if (gap <= 0) gap += Math.PI * 2;
    if (gap < MIN_GAP) return null;
    if (gap > STRAIGHT_GAP) {
      corners.push(null);
      continue;
    }
    const c = corner(a, b);
    if (!c) return null;
    trims[i] = Math.max(trims[i], c[0]);
    trims[(i + 1) % k] = Math.max(trims[(i + 1) % k], c[1]);
    corners.push(edgePoint(nx, nz, a, c[0], 1));
  }
  for (let i = 0; i < k; i++) {
    if (trims[i] > MAX_TRIM || trims[i] > arms[i].length * MAX_TRIM_SHARE) return null;
  }
  const ring: number[] = [];
  const push = (p: [number, number]) => {
    const n = ring.length;
    if (n >= 2 && Math.hypot(ring[n - 2] - p[0], ring[n - 1] - p[1]) < 0.01) return;
    ring.push(p[0], p[1]);
  };
  for (let i = 0; i < k; i++) {
    push(edgePoint(nx, nz, arms[i], trims[i], -1));
    push(edgePoint(nx, nz, arms[i], trims[i], 1));
    const c = corners[i];
    if (c) push(c);
  }
  if (ring.length >= 4 && Math.hypot(ring[0] - ring[ring.length - 2], ring[1] - ring[ring.length - 1]) < 0.01) {
    ring.length -= 2;
  }
  if (ring.length < 6 || signedArea(ring) <= 0) return null;
  return { ring, trims };
}

/**
 * Kreuzungspolygone für alle Knoten mit ≥ 3 Fahrbahn-Armen und die Kürzung der Arme.
 * Rückfall bei fast parallelen oder sehr kurzen Armen: Kreisscheibe mit dem Radius der breitesten Straße.
 */
export function buildJunctions(
  pieces: WayPiece[],
  /** Knoten ohne Kreuzungspolygon (z. B. auf Kreisverkehren). */
  skipNodes: Set<number> = new Set(),
): { junctions: JunctionShape[]; trims: Map<number, PieceTrim> } {
  const armsAt = new Map<number, Arm[]>();
  const add = (node: number, arm: Arm) => {
    let l = armsAt.get(node);
    if (!l) armsAt.set(node, (l = []));
    l.push(arm);
  };
  for (const p of pieces) {
    if (!isJunctionKind(p.kind) || p.coords.length < 4) continue;
    add(p.startNode, makeArm(p, true));
    add(p.endNode, makeArm(p, false));
  }
  const junctions: JunctionShape[] = [];
  const trims = new Map<number, PieceTrim>();
  const setTrim = (a: Arm, t: number) => {
    let tr = trims.get(a.piece.id);
    if (!tr) trims.set(a.piece.id, (tr = { start: 0, end: 0 }));
    const v = Math.min(t, a.length * MAX_TRIM_SHARE);
    if (a.atStart) tr.start = v;
    else tr.end = v;
  };
  for (const node of [...armsAt.keys()].sort((a, b) => a - b)) {
    const arms = armsAt.get(node)!;
    if (arms.length < 3 || skipNodes.has(node)) continue;
    arms.sort((a, b) => a.angle - b.angle || a.piece.id - b.piece.id);
    const c = arms[0].piece.coords;
    const [nx, nz] = arms[0].atStart ? [c[0], c[1]] : [c[c.length - 2], c[c.length - 1]];
    const shape = shapeOf(nx, nz, arms);
    if (shape) {
      arms.forEach((a, i) => setTrim(a, shape.trims[i]));
      junctions.push({ node, x: nx, z: nz, ring: shape.ring, fallback: false });
    } else {
      const r = Math.max(...arms.map((a) => Math.max(a.left, a.right))) + 0.5;
      arms.forEach((a) => setTrim(a, r));
      junctions.push({ node, x: nx, z: nz, ring: circle(nx, nz, r), fallback: true });
    }
  }
  return { junctions, trims };
}
