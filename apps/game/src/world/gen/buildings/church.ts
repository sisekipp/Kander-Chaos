import type { ChurchTower } from '@kandern/world-format';
import type { GeoBuilder } from '../GeoBuilder.ts';
import { Facade, type RGB } from '../palette.ts';
import { shade, type V3 } from './walls.ts';

/** Dachneigung des Kirchenschiffs (Grad) und Mindesthöhe des Turms (m). */
export const NAVE_ROOF_PITCH = 55;
export const MIN_TOWER_HEIGHT = 22;
/** Spitzhelm: Höhe = Faktor × Turmbreite. */
export const SPIRE_FACTOR = 2.7;

const STONE: RGB = [0.93, 0.9, 0.84];
const SLATE: RGB = [0.33, 0.35, 0.38];

/** Dachhöhe des Kirchenschiffs bei 55° Neigung über der halben Breite (nie flacher als in den Daten). */
export function naveRoofHeight(halfShort: number, dataRoofHeight: number): number {
  return Math.max(dataRoofHeight, halfShort * Math.tan((NAVE_ROOF_PITCH * Math.PI) / 180));
}

/** Turmhöhe bis zur Traufe des Spitzhelms (über dem tiefsten Geländepunkt). */
export function towerHeight(wallHeight: number, naveRidge: number): number {
  return Math.max(MIN_TOWER_HEIGHT, 2.5 * wallHeight, naveRidge + 4);
}

/**
 * Kirchturm: quadratischer Schaft (Fassadencode Kirchturm, uv.x 0 … 1 je Seite, uv.y Höhe; uv2.y = Turmhöhe
 * für die Schallöffnungen) mit Spitzhelm (Pyramide). Gibt die Spitzenhöhe zurück.
 */
export function addChurchTower(g: GeoBuilder, t: ChurchTower, gMin: number, height: number): number {
  const half = t.size / 2;
  const ux = Math.cos(t.rot),
    uz = Math.sin(t.rot);
  const vx = -uz,
    vz = ux;
  const corner = (a: number, c: number, y: number): V3 => [
    t.x + ux * a * half + vx * c * half,
    y,
    t.z + uz * a * half + vz * c * half,
  ];
  const base = gMin - 0.6;
  const top = gMin + height;
  const corners: [number, number][] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  const lo = shade(STONE, 0.7);
  for (let i = 0; i < 4; i++) {
    const [a0, c0] = corners[i],
      [a1, c1] = corners[(i + 1) % 4];
    const mid: V3 = [ux * (a0 + a1) + vx * (c0 + c1), 0, uz * (a0 + a1) + vz * (c0 + c1)];
    g.quad(
      corner(a0, c0, base),
      corner(a1, c1, base),
      corner(a1, c1, top),
      corner(a0, c0, top),
      mid,
      [lo, lo, STONE, STONE],
      [
        [0, base - gMin],
        [1, base - gMin],
        [1, height],
        [0, height],
      ],
      [Facade.ChurchTower, height],
    );
  }
  // Spitzhelm mit kleinem Überstand
  const spireTop = top + SPIRE_FACTOR * t.size;
  const apex: V3 = [t.x, spireTop, t.z];
  const ov = 1.08;
  for (let i = 0; i < 4; i++) {
    const [a0, c0] = corners[i],
      [a1, c1] = corners[(i + 1) % 4];
    const out: V3 = [ux * (a0 + a1) + vx * (c0 + c1), 0.35, uz * (a0 + a1) + vz * (c0 + c1)];
    g.tri(
      corner(a0 * ov, c0 * ov, top - 0.1),
      corner(a1 * ov, c1 * ov, top - 0.1),
      apex,
      out,
      [shade(SLATE, 0.85), shade(SLATE, 0.85), SLATE],
      [
        [0, 0],
        [t.size, 0],
        [t.size / 2, spireTop - top],
      ],
      [Facade.RoofTile, 0],
    );
  }
  return spireTop;
}
