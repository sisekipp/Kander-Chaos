import { describe, expect, it } from 'vite-plus/test';
import { DEFAULT_HEIGHT_QUANT, sampleHeight } from '@kandern/world-format';
import { buildTerrainLods } from './terrain.ts';

const hill = (x: number, z: number) => 350 + 40 * Math.sin(x * 0.01) + 25 * Math.cos(z * 0.013);

describe('Gelände-LODs', () => {
  it('Kanten benachbarter Kacheln sind identisch', () => {
    const a = buildTerrainLods(hill, 0, 0, 250, [126, 33, 9], DEFAULT_HEIGHT_QUANT);
    const b = buildTerrainLods(hill, 1, 0, 250, [126, 33, 9], DEFAULT_HEIGHT_QUANT);
    const c = buildTerrainLods(hill, 0, 1, 250, [126, 33, 9], DEFAULT_HEIGHT_QUANT);
    for (let l = 0; l < 3; l++) {
      const n = a[l].samples;
      for (let j = 0; j < n; j++) expect(a[l].heights[j * n + (n - 1)]).toBe(b[l].heights[j * n]);
      for (let i = 0; i < n; i++) expect(a[l].heights[(n - 1) * n + i]).toBe(c[l].heights[i]);
    }
  });

  it('Höhengenauigkeit unter 2 m gegenüber der Quelle', () => {
    const [lod0] = buildTerrainLods(hill, 2, -3, 250, [126], DEFAULT_HEIGHT_QUANT);
    const t = { quant: DEFAULT_HEIGHT_QUANT, size: 250 };
    for (const [lx, lz] of [
      [0, 0],
      [17.3, 99.1],
      [125, 125],
      [249, 3],
    ]) {
      const expected = hill(2 * 250 + lx, -3 * 250 + lz);
      expect(Math.abs(sampleHeight(t, lod0, lx, lz) - expected)).toBeLessThan(0.1);
    }
  });
});
