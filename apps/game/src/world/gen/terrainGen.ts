import { heightAt, type TileData } from '@kandern/world-format';
import type { GeometryBuffers } from './GeoBuilder.ts';
import { LandLookup } from './landLookup.ts';
import { sampleLand } from '../terrain/landBlend.ts';

export interface TerrainOptions {
  lod: number;
  /** Tiefe der Schürzen an den Rändern (m) gegen Risse zwischen Kacheln/LODs. */
  skirtDepth: number;
  /** Optional vorbereitete Landnutzung (wird sonst erzeugt). */
  land?: LandLookup;
  /** Eingebackene Verschattung 0 … 1 je Position (Gebäude, Bäume); fehlt = keine. */
  shade?: (x: number, z: number) => number;
}

/**
 * Geländegitter einer Kachel in Kachel-lokalen Koordinaten mit glatten Normalen, Schürzen und
 * Vertex-Daten für den Boden-Shader:
 * - color: weich gemischte Landnutzungsfarbe × eingebackene Verschattung (leichtes Farbrauschen)
 * - uv: Gewichte Acker-Furchen, Wald;  uv2: Gewicht Siedlung, Furchenrichtung (rad)
 */
export function buildTerrain(tile: TileData, opts: TerrainOptions): GeometryBuffers {
  const lod = tile.lods[Math.min(opts.lod, tile.lods.length - 1)];
  const n = lod.samples;
  const step = tile.size / (n - 1);
  const land = opts.land ?? new LandLookup(tile.land);
  const vCount = n * n + 8 * n; // Gitter + Schürzenring (oben leicht versenkt, unten tief)
  const positions = new Float32Array(vCount * 3);
  const normals = new Float32Array(vCount * 3);
  const colors = new Float32Array(vCount * 4);
  const uvs = new Float32Array(vCount * 2);
  const uvs2 = new Float32Array(vCount * 2);
  const angles = new Map<number, number>();
  const h = (i: number, j: number) =>
    heightAt(tile, lod, Math.min(n - 1, Math.max(0, i)), Math.min(n - 1, Math.max(0, j)));

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      const x = i * step,
        z = j * step;
      positions[k * 3] = x;
      positions[k * 3 + 1] = h(i, j);
      positions[k * 3 + 2] = z;
      // Zentrale Differenzen; an den Rändern einseitig -> Nachbarkacheln weichen minimal ab, Schürze verdeckt das
      const dx = (h(i + 1, j) - h(i - 1, j)) / ((Math.min(i + 1, n - 1) - Math.max(i - 1, 0)) * step);
      const dz = (h(i, j + 1) - h(i, j - 1)) / ((Math.min(j + 1, n - 1) - Math.max(j - 1, 0)) * step);
      const len = Math.hypot(dx, 1, dz);
      normals[k * 3] = -dx / len;
      normals[k * 3 + 1] = 1 / len;
      normals[k * 3 + 2] = -dz / len;
      const ls = sampleLand(land, x, z, tile.size, angles);
      const f = (0.96 + 0.08 * hashNoise(tile.tx * 1000 + i, tile.tz * 1000 + j)) * (opts.shade?.(x, z) ?? 1);
      colors[k * 4] = ls.color[0] * f;
      colors[k * 4 + 1] = ls.color[1] * f;
      colors[k * 4 + 2] = ls.color[2] * f;
      colors[k * 4 + 3] = 1;
      uvs[k * 2] = ls.farm;
      uvs[k * 2 + 1] = ls.forest;
      uvs2[k * 2] = ls.settlement;
      uvs2[k * 2 + 1] = ls.angle;
    }
  }

  const indices: number[] = [];
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i;
      indices.push(a, a + 1, a + n, a + 1, a + n + 1, a + n);
    }
  }

  // Schürzen: Randkante in zwei Reihen nach unten kopieren. Die obere Reihe liegt 5 cm unter der
  // Oberfläche, damit die senkrechten Flächen von oben nicht als helle Linie (Z-Fighting) durchscheinen.
  const edges: number[][] = [
    Array.from({ length: n }, (_, i) => i), // Süd (j=0)
    Array.from({ length: n }, (_, j) => j * n + (n - 1)), // Ost
    Array.from({ length: n }, (_, i) => (n - 1) * n + (n - 1 - i)), // Nord
    Array.from({ length: n }, (_, j) => (n - 1 - j) * n), // West
  ];
  let next = n * n;
  const copyVert = (src: number, dy: number) => {
    positions[next * 3] = positions[src * 3];
    positions[next * 3 + 1] = positions[src * 3 + 1] - dy;
    positions[next * 3 + 2] = positions[src * 3 + 2];
    normals.set(normals.subarray(src * 3, src * 3 + 3), next * 3);
    colors.set(colors.subarray(src * 4, src * 4 + 4), next * 4);
    uvs.set(uvs.subarray(src * 2, src * 2 + 2), next * 2);
    uvs2.set(uvs2.subarray(src * 2, src * 2 + 2), next * 2);
    return next++;
  };
  for (const edge of edges) {
    const top = edge.map((src) => copyVert(src, 0.05));
    const bottom = edge.map((src) => copyVert(src, opts.skirtDepth));
    for (let k = 0; k < edge.length - 1; k++) {
      const a = top[k],
        b = top[k + 1],
        c = bottom[k],
        d = bottom[k + 1];
      // beidseitig, damit die Orientierung egal ist
      indices.push(a, c, b, b, c, d, a, b, c, b, d, c);
    }
  }
  return { positions, normals, colors, uvs, uvs2, indices: new Uint32Array(indices) };
}

/** Billiges deterministisches Rauschen [0,1). */
export function hashNoise(x: number, z: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
