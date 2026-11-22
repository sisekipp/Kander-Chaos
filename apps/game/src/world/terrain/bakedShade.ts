import { distanceToRing, type Building } from '@kandern/world-format';

/** Reichweite der Abdunkelung um Gebäude (m) und Helligkeit direkt an der Wand. */
export const BUILDING_SHADE_RADIUS = 3;
export const BUILDING_SHADE_MIN = 0.7;
/** Abdunkelung unter Baumkronen in der Mitte (Anteil). */
export const TREE_SHADE = 0.3;
/** Kronenradius eines Baums mit Skalierung 1 (m). */
const CROWN_RADIUS = 2.6;
const CELL = 8;

const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

/**
 * Eingebackene Verschattung des Bodens: dunkler am Fuß von Gebäuden und unter Bäumen.
 * Liefert einen Faktor 0 … 1 je Position (Kachel-lokal). Bäume als Instanzmatrizen (16 Floats je Baum).
 */
export function createShadeSampler(
  buildings: Building[],
  treeMatrices: Float32Array[],
): (x: number, z: number) => number {
  const boxes = buildings.map((b) => {
    let minX = Infinity,
      minZ = Infinity,
      maxX = -Infinity,
      maxZ = -Infinity;
    for (let i = 0; i < b.outline.length; i += 2) {
      minX = Math.min(minX, b.outline[i]);
      maxX = Math.max(maxX, b.outline[i]);
      minZ = Math.min(minZ, b.outline[i + 1]);
      maxZ = Math.max(maxZ, b.outline[i + 1]);
    }
    const r = BUILDING_SHADE_RADIUS;
    return { ring: b.outline, minX: minX - r, minZ: minZ - r, maxX: maxX + r, maxZ: maxZ + r };
  });
  // Bäume in ein grobes Raster einsortieren
  const grid = new Map<number, number[]>();
  const key = (cx: number, cz: number) => cx * 65536 + cz;
  for (const m of treeMatrices)
    for (let i = 0; i < m.length; i += 16) {
      const x = m[i + 12],
        z = m[i + 14],
        r = CROWN_RADIUS * Math.hypot(m[i], m[i + 2]);
      const k = key(Math.floor(x / CELL), Math.floor(z / CELL));
      let l = grid.get(k);
      if (!l) grid.set(k, (l = []));
      l.push(x, z, r);
    }
  return (x, z) => {
    let f = 1;
    for (const b of boxes) {
      if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue;
      const d = distanceToRing(x, z, b.ring);
      f = Math.min(f, BUILDING_SHADE_MIN + (1 - BUILDING_SHADE_MIN) * smooth(d / BUILDING_SHADE_RADIUS));
    }
    const cx = Math.floor(x / CELL),
      cz = Math.floor(z / CELL);
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        const l = grid.get(key(cx + dx, cz + dz));
        if (!l) continue;
        for (let i = 0; i < l.length; i += 3) {
          const d = Math.hypot(x - l[i], z - l[i + 1]);
          if (d < l[i + 2]) f *= 1 - TREE_SHADE * (1 - smooth(d / l[i + 2]));
        }
      }
    return f;
  };
}
