/** Geometrie-Helfer für flache Koordinatenlisten [x0,z0,x1,z1,...]. Von Pipeline und Spiel genutzt. */

export type Flat = ArrayLike<number>;

/** Vorzeichenbehaftete Fläche (Shoelace). > 0 = gegen den Uhrzeigersinn (x nach Osten, z nach Norden). */
export function signedArea(p: Flat): number {
  let a = 0;
  const n = p.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) a += p[j * 2] * p[i * 2 + 1] - p[i * 2] * p[j * 2 + 1];
  return a / 2;
}

export function reverseRing(p: Flat): number[] {
  const out: number[] = [];
  for (let i = p.length / 2 - 1; i >= 0; i--) out.push(p[i * 2], p[i * 2 + 1]);
  return out;
}

export function ensureCCW(p: Flat): number[] {
  return signedArea(p) < 0 ? reverseRing(p) : Array.from(p);
}

export function ensureCW(p: Flat): number[] {
  return signedArea(p) > 0 ? reverseRing(p) : Array.from(p);
}

/** Flächenschwerpunkt; fällt bei entarteten Ringen auf den Mittelwert zurück. */
export function centroid(p: Flat): [number, number] {
  const n = p.length / 2;
  let a = 0,
    cx = 0,
    cz = 0;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const f = p[j * 2] * p[i * 2 + 1] - p[i * 2] * p[j * 2 + 1];
    a += f;
    cx += (p[j * 2] + p[i * 2]) * f;
    cz += (p[j * 2 + 1] + p[i * 2 + 1]) * f;
  }
  if (Math.abs(a) < 1e-9) {
    let sx = 0,
      sz = 0;
    for (let i = 0; i < n; i++) {
      sx += p[i * 2];
      sz += p[i * 2 + 1];
    }
    return [sx / n, sz / n];
  }
  return [cx / (3 * a), cz / (3 * a)];
}

export function pointInRing(x: number, z: number, p: Flat): boolean {
  let inside = false;
  const n = p.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = p[i * 2],
      zi = p[i * 2 + 1],
      xj = p[j * 2],
      zj = p[j * 2 + 1];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Kleinster Abstand eines Punktes zum Rand eines Rings. */
export function distanceToRing(x: number, z: number, p: Flat): number {
  let best = Infinity;
  const n = p.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    best = Math.min(best, distToSegment(x, z, p[j * 2], p[j * 2 + 1], p[i * 2], p[i * 2 + 1]));
  }
  return best;
}

export function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax,
    dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

export interface OrientedRect {
  cx: number;
  cz: number;
  /** Einheitsvektor der langen Achse. */
  ux: number;
  uz: number;
  /** halbe Länge entlang u bzw. senkrecht dazu. */
  halfLong: number;
  halfShort: number;
  /** Verhältnis Polygonfläche / Rechteckfläche (1 = exakt rechteckig). */
  fill: number;
}

/** Minimales umschließendes Rechteck über alle Kantenrichtungen (rotating calipers light). */
export function orientedRect(p: Flat): OrientedRect {
  const n = p.length / 2;
  const area = Math.abs(signedArea(p));
  let best: OrientedRect | null = null;
  let bestArea = Infinity;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    let ex = p[j * 2] - p[i * 2],
      ez = p[j * 2 + 1] - p[i * 2 + 1];
    const len = Math.hypot(ex, ez);
    if (len < 1e-6) continue;
    ex /= len;
    ez /= len;
    let minU = Infinity,
      maxU = -Infinity,
      minV = Infinity,
      maxV = -Infinity;
    for (let k = 0; k < n; k++) {
      const x = p[k * 2],
        z = p[k * 2 + 1];
      const u = x * ex + z * ez;
      const v = -x * ez + z * ex;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    const a = (maxU - minU) * (maxV - minV);
    if (a < bestArea - 1e-9) {
      bestArea = a;
      const cu = (minU + maxU) / 2,
        cv = (minV + maxV) / 2;
      const cx = cu * ex - cv * ez,
        cz = cu * ez + cv * ex;
      const lu = (maxU - minU) / 2,
        lv = (maxV - minV) / 2;
      best =
        lu >= lv
          ? { cx, cz, ux: ex, uz: ez, halfLong: lu, halfShort: lv, fill: 0 }
          : { cx, cz, ux: -ez, uz: ex, halfLong: lv, halfShort: lu, fill: 0 };
    }
  }
  if (!best) return { cx: p[0] ?? 0, cz: p[1] ?? 0, ux: 1, uz: 0, halfLong: 0, halfShort: 0, fill: 0 };
  best.fill = bestArea > 0 ? area / bestArea : 0;
  return best;
}

/** Sutherland-Hodgman-Zuschnitt eines Rings auf ein achsparalleles Rechteck. */
export function clipRingToRect(p: Flat, minX: number, minZ: number, maxX: number, maxZ: number): number[] {
  let pts: number[] = Array.from(p);
  const edges: [number, number, boolean][] = [
    [0, minX, true],
    [0, maxX, false],
    [1, minZ, true],
    [1, maxZ, false],
  ];
  for (const [axis, v, keepGreater] of edges) {
    const n = pts.length / 2;
    if (n === 0) break;
    const out: number[] = [];
    const inside = (i: number) => (keepGreater ? pts[i * 2 + axis] >= v : pts[i * 2 + axis] <= v);
    for (let i = 0; i < n; i++) {
      const j = (i + n - 1) % n;
      const ci = inside(i),
        cj = inside(j);
      if (ci !== cj) {
        const a = pts[j * 2 + axis],
          b = pts[i * 2 + axis];
        const t = (v - a) / (b - a);
        out.push(pts[j * 2] + t * (pts[i * 2] - pts[j * 2]), pts[j * 2 + 1] + t * (pts[i * 2 + 1] - pts[j * 2 + 1]));
      }
      if (ci) out.push(pts[i * 2], pts[i * 2 + 1]);
    }
    pts = out;
  }
  return pts;
}

export interface ClippedLine {
  points: number[];
  /** Index des Schnitts am Anfang/Ende (-1 = Originalende der Linie). */
  startCut: number;
  endCut: number;
}

/**
 * Schneidet eine Polylinie an einem Rechteck (Liang-Barsky je Segment). Liefert die Teilstücke
 * innerhalb. `startCut`/`endCut` sind globale Segment-Indizes der Schnittkante, sodass
 * benachbarte Kacheln für denselben Schnittpunkt dieselbe Kennung ableiten können.
 */
export function clipPolylineToRect(p: Flat, minX: number, minZ: number, maxX: number, maxZ: number): ClippedLine[] {
  const res: ClippedLine[] = [];
  let cur: ClippedLine | null = null;
  const n = p.length / 2;
  for (let i = 0; i < n - 1; i++) {
    const x0 = p[i * 2],
      z0 = p[i * 2 + 1],
      x1 = p[i * 2 + 2],
      z1 = p[i * 2 + 3];
    const dx = x1 - x0,
      dz = z1 - z0;
    let t0 = 0,
      t1 = 1;
    const clip = (pp: number, q: number) => {
      if (Math.abs(pp) < 1e-12) return q >= 0;
      const r = q / pp;
      if (pp < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
      return true;
    };
    const ok = clip(-dx, x0 - minX) && clip(dx, maxX - x0) && clip(-dz, z0 - minZ) && clip(dz, maxZ - z0);
    if (!ok || t1 < t0) {
      if (cur) {
        res.push(cur);
        cur = null;
      }
      continue;
    }
    const ax = x0 + t0 * dx,
      az = z0 + t0 * dz,
      bx = x0 + t1 * dx,
      bz = z0 + t1 * dz;
    if (!cur) {
      cur = { points: [ax, az], startCut: t0 > 0 ? i : i === 0 ? -1 : i, endCut: -1 };
      if (t0 === 0 && i > 0) cur.startCut = i; // Eintritt genau an einem Stützpunkt
      if (t0 === 0 && i === 0) cur.startCut = -1;
    }
    cur.points.push(bx, bz);
    if (t1 < 1) {
      cur.endCut = i;
      res.push(cur);
      cur = null;
    }
  }
  if (cur) {
    cur.endCut = -1;
    res.push(cur);
  }
  return res.filter((c) => c.points.length >= 4);
}
