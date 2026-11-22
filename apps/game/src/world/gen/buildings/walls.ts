import earcut from 'earcut';
import type { GeoBuilder } from '../GeoBuilder.ts';
import { Facade, type RGB } from '../palette.ts';

export type V3 = [number, number, number];
const UP: V3 = [0, 1, 0];

export const shade = (c: RGB, f: number): RGB => [c[0] * f, c[1] * f, c[2] * f];

/** Wände entlang des echten Grundrisses (CCW), unten mit eingebackener Verdeckung abgedunkelt. */
export function addWalls(
  g: GeoBuilder,
  o: Float32Array,
  base: number,
  top: number,
  gMin: number,
  bottomCol: RGB,
  topCol: RGB,
  uv2: [number, number],
): void {
  const n = o.length / 2;
  let u = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const x0 = o[i * 2],
      z0 = o[i * 2 + 1],
      x1 = o[j * 2],
      z1 = o[j * 2 + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 0.05) continue;
    // Außennormale: rechts der Kante bei CCW-Umlauf
    const out: V3 = [(z1 - z0) / len, 0, -(x1 - x0) / len];
    const vb = base - gMin,
      vt = top - gMin;
    g.quad(
      [x0, base, z0],
      [x1, base, z1],
      [x1, top, z1],
      [x0, top, z0],
      out,
      [bottomCol, bottomCol, topCol, topCol],
      [
        [u, vb],
        [u + len, vb],
        [u + len, vt],
        [u, vt],
      ],
      uv2,
    );
    u += len;
  }
}

/** Flache Dachkappe per Triangulierung; optional mit Seitenwänden bis `wallFrom` (vereinfachte Blöcke). */
export function flatCap(
  g: GeoBuilder,
  o: Float32Array,
  y: number,
  color: RGB,
  wallFrom: number | null,
  wall: RGB,
  levelH: number,
): void {
  const flat: number[] = Array.from(o);
  const tris = earcut(flat);
  for (let k = 0; k < tris.length; k += 3) {
    const a = tris[k],
      b = tris[k + 1],
      c = tris[k + 2];
    g.tri(
      [o[a * 2], y, o[a * 2 + 1]],
      [o[b * 2], y, o[b * 2 + 1]],
      [o[c * 2], y, o[c * 2 + 1]],
      UP,
      [color, color, color],
      [
        [o[a * 2], o[a * 2 + 1]],
        [o[b * 2], o[b * 2 + 1]],
        [o[c * 2], o[c * 2 + 1]],
      ],
      [Facade.RoofFlat, 0],
    );
  }
  if (wallFrom !== null && y - wallFrom > 0.05) {
    const n = o.length / 2;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const x0 = o[i * 2],
        z0 = o[i * 2 + 1],
        x1 = o[j * 2],
        z1 = o[j * 2 + 1];
      const len = Math.hypot(x1 - x0, z1 - z0);
      if (len < 0.05) continue;
      const out: V3 = [(z1 - z0) / len, 0, -(x1 - x0) / len];
      g.quad(
        [x0, wallFrom, z0],
        [x1, wallFrom, z1],
        [x1, y, z1],
        [x0, y, z0],
        out,
        [wall, wall, wall, wall],
        undefined,
        [Facade.Plain, levelH],
      );
    }
  }
}

/** Quader (z. B. Schornstein) aus Mitte, Längsachse (ux, uz), halben Maßen und Höhenbereich. */
export function addBox(
  g: GeoBuilder,
  cx: number,
  cz: number,
  ux: number,
  uz: number,
  halfA: number,
  halfC: number,
  bottom: number,
  top: number,
  color: RGB,
  uv2: [number, number],
): void {
  const vx = -uz,
    vz = ux;
  const p = (a: number, c: number, y: number): V3 => [cx + ux * a + vx * c, y, cz + uz * a + vz * c];
  const cols: [RGB, RGB, RGB, RGB] = [shade(color, 0.85), shade(color, 0.85), color, color];
  const side = (a0: number, c0: number, a1: number, c1: number, out: V3) =>
    g.quad(p(a0, c0, bottom), p(a1, c1, bottom), p(a1, c1, top), p(a0, c0, top), out, cols, undefined, uv2);
  side(-halfA, -halfC, halfA, -halfC, [-vx, 0, -vz]);
  side(halfA, -halfC, halfA, halfC, [ux, 0, uz]);
  side(halfA, halfC, -halfA, halfC, [vx, 0, vz]);
  side(-halfA, halfC, -halfA, -halfC, [-ux, 0, -uz]);
  g.quad(
    p(-halfA, -halfC, top),
    p(halfA, -halfC, top),
    p(halfA, halfC, top),
    p(-halfA, halfC, top),
    UP,
    [color, color, color, color],
    undefined,
    uv2,
  );
}
