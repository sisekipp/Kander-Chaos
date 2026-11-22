import type { WayPiece } from './network.ts';

/** Kreisverkehr in Weltkoordinaten. */
export interface RoundaboutShape {
  x: number;
  z: number;
  /** Radius der Fahrbahnmitte. */
  radius: number;
  width: number;
  /** Knoten auf dem Ring (dort keine Kreuzungspolygone). */
  nodes: Set<number>;
  /** Stück-IDs des Rings (werden im Spiel nicht als Band gezeichnet). */
  pieceIds: Set<number>;
}

/** Zufahrten enden knapp innerhalb des Außenrands, der Ring liegt darüber (keine Lücken). */
const OVERLAP = 0.3;

/** Kreis durch Punkte (algebraische Ausgleichsrechnung nach Kåsa); Rückfall: Schwerpunkt + mittlerer Abstand. */
export function fitCircle(pts: number[]): { x: number; z: number; r: number } {
  const n = pts.length / 2;
  let mx = 0,
    mz = 0;
  for (let i = 0; i < n; i++) {
    mx += pts[i * 2] / n;
    mz += pts[i * 2 + 1] / n;
  }
  let suu = 0,
    svv = 0,
    suv = 0,
    suuu = 0,
    svvv = 0,
    suvv = 0,
    svuu = 0;
  for (let i = 0; i < n; i++) {
    const u = pts[i * 2] - mx,
      v = pts[i * 2 + 1] - mz;
    suu += u * u;
    svv += v * v;
    suv += u * v;
    suuu += u * u * u;
    svvv += v * v * v;
    suvv += u * v * v;
    svuu += v * u * u;
  }
  const det = suu * svv - suv * suv;
  let cx = mx,
    cz = mz;
  if (Math.abs(det) > 1e-9) {
    const b1 = 0.5 * (suuu + suvv),
      b2 = 0.5 * (svvv + svuu);
    cx = mx + (b1 * svv - b2 * suv) / det;
    cz = mz + (b2 * suu - b1 * suv) / det;
  }
  let r = 0;
  for (let i = 0; i < n; i++) r += Math.hypot(pts[i * 2] - cx, pts[i * 2 + 1] - cz) / n;
  return { x: cx, z: cz, r };
}

/** Länge entlang der Polylinie (vom Knotenende aus), ab der der Abstand zur Mitte `dist` erreicht. */
function trimToRadius(c: number[], fromStart: boolean, cx: number, cz: number, dist: number): number {
  const n = c.length / 2;
  const at = (i: number) => (fromStart ? i : n - 1 - i);
  let acc = 0;
  for (let k = 1; k < n; k++) {
    const ax = c[at(k - 1) * 2],
      az = c[at(k - 1) * 2 + 1],
      bx = c[at(k) * 2],
      bz = c[at(k) * 2 + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const da = Math.hypot(ax - cx, az - cz),
      db = Math.hypot(bx - cx, bz - cz);
    if (db >= dist && da < dist) return acc + (len * (dist - da)) / Math.max(1e-6, db - da);
    acc += len;
  }
  return 0;
}

/**
 * Fasst zusammenhängende Kreisverkehr-Stücke zu Kreisen zusammen und kürzt die Zufahrten bis knapp
 * an den Außenrand. Ring-Stücke selbst zeichnet das Spiel nicht als Band, sondern als Ring.
 */
export function buildRoundabouts(pieces: WayPiece[]): {
  shapes: RoundaboutShape[];
  trims: Map<number, { start?: number; end?: number }>;
} {
  const ring = pieces.filter((p) => p.attrs.roundabout).sort((a, b) => a.id - b.id);
  const byNode = new Map<number, WayPiece[]>();
  for (const p of ring)
    for (const n of [p.startNode, p.endNode]) {
      let l = byNode.get(n);
      if (!l) byNode.set(n, (l = []));
      l.push(p);
    }
  const used = new Set<number>();
  const shapes: RoundaboutShape[] = [];
  for (const p of ring) {
    if (used.has(p.id)) continue;
    const comp: WayPiece[] = [];
    const stack = [p];
    used.add(p.id);
    while (stack.length) {
      const c = stack.pop()!;
      comp.push(c);
      for (const n of [c.startNode, c.endNode])
        for (const o of byNode.get(n)!)
          if (!used.has(o.id)) {
            used.add(o.id);
            stack.push(o);
          }
    }
    const pts = comp.flatMap((c) => c.coords);
    if (pts.length < 6) continue;
    const { x, z, r } = fitCircle(pts);
    const width = Math.max(...comp.map((c) => c.width));
    if (r < width * 0.75 || r > 60) continue; // kein sinnvoller Kreis (z. B. Wendeschleife)
    shapes.push({
      x,
      z,
      radius: r,
      width,
      nodes: new Set(comp.flatMap((c) => [c.startNode, c.endNode])),
      pieceIds: new Set(comp.map((c) => c.id)),
    });
  }
  const trims = new Map<number, { start?: number; end?: number }>();
  for (const s of shapes) {
    const edge = s.radius + s.width / 2 - OVERLAP;
    for (const p of pieces) {
      if (p.attrs.roundabout) continue;
      const t = trims.get(p.id) ?? {};
      if (s.nodes.has(p.startNode)) t.start = trimToRadius(p.coords, true, s.x, s.z, edge);
      if (s.nodes.has(p.endNode)) t.end = trimToRadius(p.coords, false, s.x, s.z, edge);
      if (t.start !== undefined || t.end !== undefined) trims.set(p.id, t);
    }
  }
  return { shapes, trims };
}
