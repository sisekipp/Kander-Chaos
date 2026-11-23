import { describe, expect, it } from 'vite-plus/test';
import { buildFarTerrain } from '@kandern/world-format';
import { farGrid, visibleSilhouettes } from './farSelect.ts';

describe('visibleSilhouettes', () => {
  const list = [
    { x: 0, z: 1000, h: 200, w: 30, d: 30 },
    { x: 0, z: 20000, h: 100, w: 30, d: 30 },
    { x: 100, z: 0, h: 60, w: 30, d: 30 },
  ];
  it('nur im Umkreis und nicht in Ring-0/1-Kacheln', () => {
    const ringAt = (x: number, z: number) => (z < 500 ? 0 : z < 2000 ? 2 : null);
    expect(visibleSilhouettes(list, 0, 0, 12000, ringAt)).toEqual([0]);
  });
});

describe('farGrid', () => {
  const f = buildFarTerrain({ minX: 0, minZ: 0, maxX: 256, maxZ: 128 }, 64, (x) => (x > 200 ? null : 300 + x));
  it('dünnt aus, senkt ab und lässt datenlose Zellen weg', () => {
    const g = farGrid(f, 2, 4);
    // 5 × 3 Punkte -> jeder 2. -> 3 × 2
    expect(g.positions.length).toBe(3 * 2 * 3);
    expect(g.positions[1]).toBeCloseTo(296, 0);
    expect(g.indices.length).toBe(2 * 6);
    const none = farGrid(
      buildFarTerrain({ minX: 0, minZ: 0, maxX: 64, maxZ: 64 }, 64, () => null),
      1,
    );
    expect(none.indices.length).toBe(0);
  });
});
