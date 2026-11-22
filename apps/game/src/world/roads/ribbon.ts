import type { GeoBuilder } from '../gen/GeoBuilder.ts';
import { encodeMarking, type RoadProfile } from './profile.ts';

type V3 = [number, number, number];
const WHITE: [number, number, number] = [1, 1, 1];

/** Höchste Segmentlänge, damit das Band dem Gelände folgt (m). */
export const MAX_SEGMENT = 4;
/** Höhe der Fahrbahn über dem Gelände (zusätzlich Depth-Bias im Material). */
export const ROAD_LIFT = 0.1;

export interface RibbonInput {
  /** Mittellinie Kachel-lokal [x0,z0,…]. */
  points: ArrayLike<number>;
  profile: RoadProfile;
  trimStart: number;
  trimEnd: number;
  /** Geländehöhe (Kachel-lokal). */
  ground: (x: number, z: number) => number;
  /** Brückendeck am Anfang/Ende (NaN = Fahrbahn auf dem Gelände). */
  deckStart: number;
  deckEnd: number;
  /** Höhe über dem Gelände (Standard ROAD_LIFT); Wege etwas tiefer als Fahrbahnen gegen Z-Fighting. */
  lift?: number;
  /** Eigenes uv2 statt (Code, Markierung), z. B. für Gewässer. */
  uv2?: [number, number];
  /** Höhe aus Mitte/Rändern: 'max' (Straßen, sinken am Querhang nicht ein) oder 'min' (Wasser bleibt im Bett). */
  follow?: 'max' | 'min';
}

/** Schneidet die Polylinie auf den Abschnitt [s0, s1] (Längen in m) und unterteilt auf ≤ MAX_SEGMENT. */
export function trimAndDensify(p: ArrayLike<number>, s0: number, s1: number): { pts: number[]; s: number[] } {
  const pts: number[] = [];
  const s: number[] = [];
  const push = (x: number, z: number, d: number) => {
    pts.push(x, z);
    s.push(d);
  };
  let acc = 0;
  for (let i = 2; i < p.length; i += 2) {
    const x0 = p[i - 2],
      z0 = p[i - 1],
      x1 = p[i],
      z1 = p[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const a = Math.max(s0, acc),
      b = Math.min(s1, acc + len);
    if (b > a && len > 0) {
      const steps = Math.max(1, Math.ceil((b - a) / MAX_SEGMENT));
      for (let k = s.length === 0 ? 0 : 1; k <= steps; k++) {
        const d = a + ((b - a) * k) / steps;
        const t = (d - acc) / len;
        push(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, d);
      }
    }
    acc += len;
  }
  return { pts, s };
}

export function polylineLength(p: ArrayLike<number>): number {
  let l = 0;
  for (let i = 2; i < p.length; i += 2) l += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]);
  return l;
}

/**
 * Extrudiert den Querschnitt entlang der Mittellinie in den Builder.
 * uv = (Querlage in m, Längsposition in m), uv2 = (Belag-Code, kodierte Markierung).
 * Höhe: Brückendeck linear entlang der Länge bzw. Gelände (Maximum Mitte/Ränder), jeweils + Lift
 * (gleiche Anhebung, damit Brückenenden nahtlos an die Straße anschließen).
 * Gibt die Länge des erzeugten Abschnitts zurück (0 = vollständig weggekürzt).
 */
export function extrudeRibbon(g: GeoBuilder, r: RibbonInput): number {
  const L = polylineLength(r.points);
  const s0 = Math.max(0, r.trimStart),
    s1 = L - Math.max(0, r.trimEnd);
  if (s1 - s0 < 0.2) return 0;
  const { pts, s } = trimAndDensify(r.points, s0, s1);
  const n = s.length;
  if (n < 2) return 0;
  const p = r.profile;
  const cs = p.segments.flatMap((seg) => [seg.a.c, seg.b.c]);
  const cMin = Math.min(...cs),
    cMax = Math.max(...cs);
  const bridge = !Number.isNaN(r.deckStart) && !Number.isNaN(r.deckEnd);
  const marking = encodeMarking(p);
  // Je Stützpunkt: Mitte, rechte Normale, Grundhöhe
  const frames: { x: number; z: number; rx: number; rz: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const ip = Math.max(0, i - 1),
      inx = Math.min(n - 1, i + 1);
    let tx = pts[inx * 2] - pts[ip * 2],
      tz = pts[inx * 2 + 1] - pts[ip * 2 + 1];
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl;
    tz /= tl;
    const rx = tz,
      rz = -tx;
    const x = pts[i * 2],
      z = pts[i * 2 + 1];
    const y = bridge
      ? r.deckStart + ((r.deckEnd - r.deckStart) * s[i]) / Math.max(1e-6, L) + (r.lift ?? ROAD_LIFT)
      : (r.follow === 'min' ? Math.min : Math.max)(
          r.ground(x, z),
          r.ground(x + rx * cMin, z + rz * cMin),
          r.ground(x + rx * cMax, z + rz * cMax),
        ) + (r.lift ?? ROAD_LIFT);
    frames.push({ x, z, rx, rz, y });
  }
  const at = (f: (typeof frames)[number], c: number, h: number): V3 => [f.x + f.rx * c, f.y + h, f.z + f.rz * c];
  for (const seg of p.segments) {
    const dc = seg.b.c - seg.a.c,
      dh = seg.b.h - seg.a.h;
    const nl = Math.hypot(dc, dh) || 1;
    const nRight = -dh / nl,
      nUp = dc / nl;
    const code: [number, number] = r.uv2 ?? [seg.code, marking];
    for (let i = 0; i < n - 1; i++) {
      const f0 = frames[i],
        f1 = frames[i + 1];
      const out: V3 = [f0.rx * nRight, nUp, f0.rz * nRight];
      g.quad(
        at(f0, seg.a.c, seg.a.h),
        at(f0, seg.b.c, seg.b.h),
        at(f1, seg.b.c, seg.b.h),
        at(f1, seg.a.c, seg.a.h),
        out,
        [WHITE, WHITE, WHITE, WHITE],
        [
          [seg.a.c, s[i]],
          [seg.b.c, s[i]],
          [seg.b.c, s[i + 1]],
          [seg.a.c, s[i + 1]],
        ],
        code,
      );
    }
  }
  return s1 - s0;
}
