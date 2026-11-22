import { LandKind, sampleHeight, type TileData } from '@kandern/world-format';
import { LandLookup } from './landLookup.ts';

export const enum TreeSpecies {
  /** Runder Laubbaum (Buche, Linde). */
  Deciduous = 0,
  Conifer = 1,
  Fruit = 2,
  /** Hoher, schlanker Laubbaum (Pappel, Esche). */
  Tall = 3,
  Bush = 4,
}

export const SPECIES_COUNT = 5;

/** Instanzmatrizen (16 Floats, Kachel-lokal) und Farbtönung (RGBA) je Baumart. */
export interface VegetationBuffers {
  matrices: Float32Array[];
  colors: Float32Array[];
  counts: number[];
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bridson-Poisson-Disk-Sampling, deterministisch über `rand`. */
export function poissonDisk(size: number, minDist: number, rand: () => number, k = 12): number[] {
  const cell = minDist / Math.SQRT2;
  const gw = Math.ceil(size / cell);
  const grid = new Int32Array(gw * gw).fill(-1);
  const pts: number[] = [];
  const active: number[] = [];
  const add = (x: number, z: number) => {
    const i = pts.length / 2;
    pts.push(x, z);
    active.push(i);
    grid[Math.floor(z / cell) * gw + Math.floor(x / cell)] = i;
  };
  add(rand() * size, rand() * size);
  while (active.length) {
    const ai = Math.floor(rand() * active.length);
    const pi = active[ai];
    const px = pts[pi * 2],
      pz = pts[pi * 2 + 1];
    let placed = false;
    for (let t = 0; t < k; t++) {
      const ang = rand() * Math.PI * 2;
      const r = minDist * (1 + rand());
      const x = px + Math.cos(ang) * r,
        z = pz + Math.sin(ang) * r;
      if (x < 0 || z < 0 || x >= size || z >= size) continue;
      const gx = Math.floor(x / cell),
        gz = Math.floor(z / cell);
      let ok = true;
      for (let zz = Math.max(0, gz - 2); zz <= Math.min(gw - 1, gz + 2) && ok; zz++) {
        for (let xx = Math.max(0, gx - 2); xx <= Math.min(gw - 1, gx + 2); xx++) {
          const q = grid[zz * gw + xx];
          if (q >= 0 && (pts[q * 2] - x) ** 2 + (pts[q * 2 + 1] - z) ** 2 < minDist * minDist) {
            ok = false;
            break;
          }
        }
      }
      if (ok) {
        add(x, z);
        placed = true;
        break;
      }
    }
    if (!placed) active.splice(ai, 1);
  }
  return pts;
}

export interface VegetationOptions {
  /** Dichtefaktor 0..1 (Qualität/Ring). */
  density: number;
  land?: LandLookup;
  /** Bäume nicht auf Straßen/in Gebäuden: Prüffunktion (Kachel-lokal). */
  blocked?: (x: number, z: number) => boolean;
}

/**
 * Art an einem Kandidatenpunkt je Landnutzung (null = kein Baum). `r` ist eine Zufallszahl 0 … 1:
 * Wälder dicht mit gemischten Formen und Unterholz, Siedlungen mit Obstbäumen und Büschen.
 */
export function speciesFor(kind: LandKind | null, r: number): TreeSpecies | null {
  switch (kind) {
    case LandKind.ForestDeciduous:
      return r < 0.62
        ? TreeSpecies.Deciduous
        : r < 0.8
          ? TreeSpecies.Tall
          : r < 0.9
            ? TreeSpecies.Bush
            : TreeSpecies.Conifer;
    case LandKind.ForestConiferous:
      return r < 0.82 ? TreeSpecies.Conifer : r < 0.92 ? TreeSpecies.Deciduous : TreeSpecies.Bush;
    case LandKind.ForestMixed:
      return r < 0.42
        ? TreeSpecies.Deciduous
        : r < 0.78
          ? TreeSpecies.Conifer
          : r < 0.9
            ? TreeSpecies.Tall
            : TreeSpecies.Bush;
    case LandKind.Orchard:
      return r < 0.45 ? TreeSpecies.Fruit : null;
    case LandKind.Park:
    case LandKind.Cemetery:
      return r < 0.08 ? TreeSpecies.Deciduous : r < 0.12 ? TreeSpecies.Tall : r < 0.16 ? TreeSpecies.Bush : null;
    case LandKind.Residential:
      return r < 0.02 ? TreeSpecies.Fruit : r < 0.04 ? TreeSpecies.Deciduous : r < 0.07 ? TreeSpecies.Bush : null;
    case LandKind.Meadow:
      return r < 0.012 ? TreeSpecies.Fruit : r < 0.02 ? TreeSpecies.Bush : null;
    case null:
      return r < 0.008 ? TreeSpecies.Deciduous : r < 0.014 ? TreeSpecies.Bush : null;
    default:
      return null;
  }
}

/** Farbtönung je Baum: Helligkeit 0,85 … 1,12, leicht gelblicher oder bläulicher Ton. */
export function treeTint(r1: number, r2: number): [number, number, number] {
  const b = 0.85 + 0.27 * r1;
  const warm = (r2 - 0.5) * 0.16;
  return [b * (1 + warm), b, b * (1 - warm)];
}

/** Baumpositionen einer Kachel, deterministisch aus der Kachel-ID. */
export function buildVegetation(tile: TileData, opts: VegetationOptions): VegetationBuffers {
  const land = opts.land ?? new LandLookup(tile.land);
  const rand = mulberry32((tile.tx * 73856093) ^ (tile.tz * 19349663) ^ 0x5eed);
  const minDist = 5.5 / Math.sqrt(Math.max(0.05, opts.density));
  const pts = poissonDisk(tile.size, minDist, rand);
  const lists: number[][] = Array.from({ length: SPECIES_COUNT }, () => []);
  const tints: number[][] = Array.from({ length: SPECIES_COUNT }, () => []);
  const lod = tile.lods[Math.min(1, tile.lods.length - 1)];
  for (let i = 0; i < pts.length; i += 2) {
    const x = pts[i],
      z = pts[i + 1];
    const kind = land.kindAt(x, z);
    const sp = speciesFor(kind, rand());
    const s = 0.75 + rand() * 0.55;
    const rot = rand() * Math.PI * 2;
    const tint = treeTint(rand(), rand());
    if (sp === null) continue;
    if (opts.blocked?.(x, z)) continue;
    const y = sampleHeight(tile, lod, x, z) - 0.2;
    const c = Math.cos(rot) * s,
      sn = Math.sin(rot) * s;
    // Spaltenweise Matrix (Babylon): Rotation um Y, gleichmäßige Skalierung, Translation
    lists[sp].push(c, 0, -sn, 0, 0, s, 0, 0, sn, 0, c, 0, x, y, z, 1);
    tints[sp].push(tint[0], tint[1], tint[2], 1);
  }
  return {
    matrices: lists.map((l) => new Float32Array(l)),
    colors: tints.map((l) => new Float32Array(l)),
    counts: lists.map((l) => l.length / 16),
  };
}
