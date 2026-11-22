import { sampleHeight, type TileData } from '@kandern/world-format';
import { GeoBuilder, type GeometryBuffers } from './GeoBuilder.ts';
import { ROAD_COLORS, WATER_COLOR, type RGB } from './palette.ts';

/** Höhe über dem Gelände; zusätzlich Depth-Bias im Material gegen Z-Fighting. */
const LIFT = 0.12;
const MAX_SEG = 4;

/**
 * Straßen- und Gewässerbänder entlang der Polylinien. Lange Segmente werden auf ≤ 4 m unterteilt,
 * damit das Band dem Gelände folgt. Tunnel werden nicht gezeichnet.
 */
export function buildRoads(tile: TileData): GeometryBuffers | null {
  const g = new GeoBuilder();
  const lod = tile.lods[0];
  const ground = (x: number, z: number) =>
    sampleHeight(tile, lod, Math.min(tile.size, Math.max(0, x)), Math.min(tile.size, Math.max(0, z)));
  // Breite Straßen zuletzt -> liegen bei gleichem Bias über Wegen
  const roads = [...tile.roads].filter((r) => !r.tunnel).sort((a, b) => a.width - b.width);
  for (const r of roads)
    ribbon(g, r.points, r.width, ROAD_COLORS[r.kind], ground, LIFT + Math.min(r.width, 10) * 0.004);
  for (const w of tile.waterways) ribbon(g, w.points, Math.max(1, w.width), WATER_COLOR, ground, 0.06);
  return g.build();
}

function densify(p: Float32Array): number[] {
  const out: number[] = [p[0], p[1]];
  for (let i = 2; i < p.length; i += 2) {
    const x0 = p[i - 2],
      z0 = p[i - 1],
      x1 = p[i],
      z1 = p[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.max(1, Math.ceil(len / MAX_SEG));
    for (let s = 1; s <= steps; s++) out.push(x0 + ((x1 - x0) * s) / steps, z0 + ((z1 - z0) * s) / steps);
  }
  return out;
}

export function ribbon(
  g: GeoBuilder,
  points: Float32Array,
  width: number,
  color: RGB,
  ground: (x: number, z: number) => number,
  lift: number,
): void {
  const p = densify(points);
  const n = p.length / 2;
  if (n < 2) return;
  const half = width / 2;
  const left: [number, number, number][] = [];
  const right: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const ip = Math.max(0, i - 1),
      inx = Math.min(n - 1, i + 1);
    let tx = p[inx * 2] - p[ip * 2],
      tz = p[inx * 2 + 1] - p[ip * 2 + 1];
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl;
    tz /= tl;
    const nx = -tz,
      nz = tx;
    const x = p[i * 2],
      z = p[i * 2 + 1];
    const lx = x + nx * half,
      lz = z + nz * half,
      rx = x - nx * half,
      rz = z - nz * half;
    // Höhe am Rand und in der Mitte; Maximum verhindert Einsinken am Querhang
    const y = Math.max(ground(x, z), ground(lx, lz), ground(rx, rz)) + lift;
    left.push([lx, y, lz]);
    right.push([rx, y, rz]);
  }
  for (let i = 0; i < n - 1; i++) {
    g.quad(left[i], right[i], right[i + 1], left[i + 1], [0, 1, 0], [color, color, color, color]);
  }
}
