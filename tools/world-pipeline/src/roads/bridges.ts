import type { WayPiece } from './network.ts';

/** Mindestabstand der Fahrbahn über dem Gelände im Inneren der Brücke (m). */
export const MIN_CLEARANCE = 0.5;
/** Größte erlaubte Steigung der Brückenfahrbahn. */
export const MAX_SLOPE = 0.12;
/** Abstand der Stützstellen des Höhenprofils (m). */
const STEP = 2;

export type HeightFn = (x: number, z: number) => number;

/** Fahrbahnhöhe eines Brückenstücks an einem Punkt auf dem Stück (Weltkoordinaten). */
export type DeckFn = (x: number, z: number) => number;

interface ChainPart {
  piece: WayPiece;
  reversed: boolean;
}

function lengthOf(c: number[]): number {
  let l = 0;
  for (let i = 2; i < c.length; i += 2) l += Math.hypot(c[i] - c[i - 2], c[i + 1] - c[i - 1]);
  return l;
}

/** Abstand entlang der Polylinie bis zum nächstgelegenen Punkt auf ihr. */
function along(c: number[], x: number, z: number): number {
  let best = Infinity,
    bestS = 0,
    s = 0;
  for (let i = 2; i < c.length; i += 2) {
    const ax = c[i - 2],
      az = c[i - 1];
    const dx = c[i] - ax,
      dz = c[i + 1] - az;
    const l2 = dx * dx + dz * dz;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0;
    const d = Math.hypot(ax + dx * t - x, az + dz * t - z);
    if (d < best) {
      best = d;
      bestS = s + Math.sqrt(l2) * t;
    }
    s += Math.sqrt(l2);
  }
  return bestS;
}

function pointAt(c: number[], s: number): [number, number] {
  let acc = 0;
  for (let i = 2; i < c.length; i += 2) {
    const l = Math.hypot(c[i] - c[i - 2], c[i + 1] - c[i - 1]);
    if (acc + l >= s || i === c.length - 2) {
      const t = l > 0 ? Math.max(0, Math.min(1, (s - acc) / l)) : 0;
      return [c[i - 2] + (c[i] - c[i - 2]) * t, c[i - 1] + (c[i + 1] - c[i - 1]) * t];
    }
    acc += l;
  }
  return [c[0], c[1]];
}

function reversedCoords(c: number[]): number[] {
  const r: number[] = [];
  for (let i = c.length - 2; i >= 0; i -= 2) r.push(c[i], c[i + 1]);
  return r;
}

/**
 * Höhenprofil eines Brückenzugs: an den Enden auf dem Gelände, dazwischen linear, im Inneren
 * mindestens MIN_CLEARANCE über dem Gelände; Steigung auf MAX_SLOPE begrenzt (nur Absenken, Enden fest).
 */
export function deckProfile(coords: number[], ground: HeightFn): { s: number[]; h: number[] } {
  const L = lengthOf(coords);
  const n = Math.max(1, Math.ceil(L / STEP));
  const s: number[] = [];
  const h: number[] = [];
  const h0 = ground(coords[0], coords[1]);
  const h1 = ground(coords[coords.length - 2], coords[coords.length - 1]);
  for (let k = 0; k <= n; k++) {
    const sk = (k / n) * L;
    s.push(sk);
    if (k === 0 || k === n) {
      h.push(k === 0 ? h0 : h1);
      continue;
    }
    const [x, z] = pointAt(coords, sk);
    const lin = h0 + ((h1 - h0) * sk) / L;
    const v = Math.max(lin, ground(x, z) + MIN_CLEARANCE);
    h.push(Math.min(v, h0 + MAX_SLOPE * sk, h1 + MAX_SLOPE * (L - sk)));
  }
  for (let k = 1; k <= n; k++) h[k] = Math.min(h[k], h[k - 1] + MAX_SLOPE * (s[k] - s[k - 1]));
  for (let k = n - 1; k >= 0; k--) h[k] = Math.min(h[k], h[k + 1] + MAX_SLOPE * (s[k + 1] - s[k]));
  return { s, h };
}

function sampleProfile(p: { s: number[]; h: number[] }, s: number): number {
  const { s: ss, h } = p;
  if (s <= ss[0]) return h[0];
  for (let k = 1; k < ss.length; k++) {
    if (s <= ss[k]) {
      const t = (s - ss[k - 1]) / (ss[k] - ss[k - 1] || 1);
      return h[k - 1] + (h[k] - h[k - 1]) * t;
    }
  }
  return h[h.length - 1];
}

/** Verkettet zusammenhängende Brückenstücke (über gemeinsame Knoten) zu Zügen; Verzweigungen -> Einzelstücke. */
export function bridgeChains(pieces: WayPiece[]): ChainPart[][] {
  const bridges = pieces.filter((p) => p.bridge && p.coords.length >= 4).sort((a, b) => a.id - b.id);
  const byNode = new Map<number, WayPiece[]>();
  for (const p of bridges)
    for (const n of [p.startNode, p.endNode]) {
      let l = byNode.get(n);
      if (!l) byNode.set(n, (l = []));
      l.push(p);
    }
  const used = new Set<number>();
  const chains: ChainPart[][] = [];
  for (const p of bridges) {
    if (used.has(p.id)) continue;
    // Komponente sammeln
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
    const nodes = new Map<number, number>();
    for (const c of comp) for (const n of [c.startNode, c.endNode]) nodes.set(n, (nodes.get(n) ?? 0) + 1);
    const ends = [...nodes].filter(([, d]) => d === 1).map(([n]) => n);
    const simplePath = ends.length === 2 && [...nodes.values()].every((d) => d <= 2);
    if (!simplePath) {
      for (const c of comp.sort((a, b) => a.id - b.id)) chains.push([{ piece: c, reversed: false }]);
      continue;
    }
    // Vom Ende mit der kleineren Knoten-ID aus ablaufen (deterministisch)
    let node = Math.min(...ends);
    const left = new Set(comp.map((c) => c.id));
    const chain: ChainPart[] = [];
    while (left.size) {
      const next = comp.find((c) => left.has(c.id) && (c.startNode === node || c.endNode === node))!;
      left.delete(next.id);
      const reversed = next.endNode === node;
      chain.push({ piece: next, reversed });
      node = reversed ? next.startNode : next.endNode;
    }
    chains.push(chain);
  }
  return chains;
}

/** Fahrbahnhöhe je Brückenstück (Stück-ID -> Funktion), gemeinsam berechnet je Brückenzug. */
export function buildBridges(pieces: WayPiece[], ground: HeightFn): Map<number, DeckFn> {
  const out = new Map<number, DeckFn>();
  for (const chain of bridgeChains(pieces)) {
    const coords: number[] = [];
    const offsets: number[] = [];
    for (const part of chain) {
      const c = part.reversed ? reversedCoords(part.piece.coords) : part.piece.coords;
      offsets.push(lengthOf(coords));
      coords.push(...(coords.length ? c.slice(2) : c));
    }
    const profile = deckProfile(coords, ground);
    chain.forEach((part, i) => {
      const c = part.piece.coords;
      const len = lengthOf(c);
      out.set(part.piece.id, (x, z) => {
        const a = along(c, x, z);
        return sampleProfile(profile, offsets[i] + (part.reversed ? len - a : a));
      });
    });
  }
  return out;
}
