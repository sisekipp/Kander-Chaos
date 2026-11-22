import { pointInRing, type TileData } from '@kandern/world-format';

/** Grobes Belegungsraster (2 m) aus Straßen und Gebäuden – hält Bäume von Wegen und Häusern fern. */
export function buildOccupancy(tile: TileData, cell = 2): (x: number, z: number) => boolean {
  const n = Math.ceil(tile.size / cell);
  const occ = new Uint8Array(n * n);
  const mark = (x: number, z: number) => {
    const i = Math.floor(x / cell),
      j = Math.floor(z / cell);
    if (i >= 0 && j >= 0 && i < n && j < n) occ[j * n + i] = 1;
  };
  for (const r of tile.roads) {
    const p = r.points;
    const reach = r.width / 2 + 1.5;
    for (let k = 2; k < p.length; k += 2) {
      const x0 = p[k - 2],
        z0 = p[k - 1],
        x1 = p[k],
        z1 = p[k + 1];
      const len = Math.hypot(x1 - x0, z1 - z0);
      const steps = Math.max(1, Math.ceil(len / cell));
      for (let s = 0; s <= steps; s++) {
        const x = x0 + ((x1 - x0) * s) / steps,
          z = z0 + ((z1 - z0) * s) / steps;
        for (let dz = -reach; dz <= reach; dz += cell)
          for (let dx = -reach; dx <= reach; dx += cell) mark(x + dx, z + dz);
      }
    }
  }
  for (const b of tile.buildings) {
    const o = b.outline;
    let minX = Infinity,
      minZ = Infinity,
      maxX = -Infinity,
      maxZ = -Infinity;
    for (let k = 0; k < o.length; k += 2) {
      minX = Math.min(minX, o[k]);
      maxX = Math.max(maxX, o[k]);
      minZ = Math.min(minZ, o[k + 1]);
      maxZ = Math.max(maxZ, o[k + 1]);
    }
    for (let z = minZ - 2; z <= maxZ + 2; z += cell) {
      for (let x = minX - 2; x <= maxX + 2; x += cell) {
        if (x < minX || x > maxX || z < minZ || z > maxZ || pointInRing(x, z, o)) mark(x, z);
      }
    }
  }
  return (x, z) => {
    const i = Math.floor(x / cell),
      j = Math.floor(z / cell);
    return i >= 0 && j >= 0 && i < n && j < n && occ[j * n + i] === 1;
  };
}
