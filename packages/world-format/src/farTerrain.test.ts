import { describe, expect, it } from 'vite-plus/test';
import { buildFarTerrain, decodeFarTerrain, encodeFarTerrain, farHeightAt } from './farTerrain.ts';

describe('Fernsicht-Gelände', () => {
  const f = buildFarTerrain({ minX: -128, minZ: 0, maxX: 128, maxZ: 64 }, 64, (x, z) =>
    x > 100 ? null : 300 + x * 0.1 + z,
  );
  it('Rastergröße und Höhen (5-cm-Schritte)', () => {
    expect([f.cols, f.rows]).toEqual([5, 2]);
    expect(farHeightAt(f, 0, 0)).toBeCloseTo(287.2, 1);
    expect(farHeightAt(f, 2, 1)).toBeCloseTo(364, 1);
    expect(farHeightAt(f, 4, 0)).toBeNull();
    expect(farHeightAt(f, 9, 0)).toBeNull();
  });
  it('Schreiben und Lesen ergibt dasselbe Raster', () => {
    const bytes = encodeFarTerrain(f);
    expect(bytes.length).toBe(28 + 10 * 2);
    const g = decodeFarTerrain(bytes);
    expect(g).toMatchObject({ minX: -128, minZ: 0, cols: 5, rows: 2, step: 64 });
    expect([...g.heights]).toEqual([...f.heights]);
  });
  it('Regionsgröße bleibt klein (18 × 34 km bei 64 m < 400 kB)', () => {
    const big = buildFarTerrain({ minX: 0, minZ: 0, maxX: 18250, maxZ: 33500 }, 64, () => 400);
    expect(encodeFarTerrain(big).length).toBeLessThan(400_000);
  });
});
