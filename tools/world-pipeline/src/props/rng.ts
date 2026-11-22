/** Deterministischer Zufall (mulberry32) aus einem Startwert, z. B. einer OSM-ID. */
export function rngFrom(seed: number): () => number {
  let a = (Math.floor(seed) ^ Math.floor(seed / 4294967296) ^ 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Gierwinkel (0 = Norden/+z) einer Richtung. */
export const yawOf = (dx: number, dz: number): number => Math.atan2(dx, dz);
