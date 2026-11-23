import { describe, expect, it } from 'vite-plus/test';
import { buildFarTerrain } from '@kandern/world-format';
import { farGrid, silhouetteBoxes, visibleSilhouettes } from './farSelect.ts';

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

describe('silhouetteBoxes', () => {
  const list = [
    { x: 100, z: 0, h: 60, w: 30, d: 20, landmarkId: 'muenster' },
    { x: 500, z: 0, h: 80, w: 10, d: 10 },
  ];
  it('Wahrzeichen aus mehreren gedrehten Quadern, sonst ein Quader', () => {
    const shapes = {
      muenster: [
        [0, 10, 0, 40, 20, 20],
        [-15, 40, 5, 6, 60, 6],
      ],
    };
    // Längsachse nach Norden (+z): lx zeigt nach +z
    const lms = new Map([['muenster', { x: 100, z: 0, ux: 0, uz: 1 }]]);
    const b = silhouetteBoxes(list, [0, 1], shapes, lms, () => 250);
    expect(b).toHaveLength(3);
    expect(b[0]).toMatchObject({ x: 100, y: 260, z: 0, sx: 40, sy: 20 });
    expect(b[1].z).toBeCloseTo(-15);
    expect(b[1].x).toBeCloseTo(95);
    expect(b[1].yaw).toBeCloseTo(-Math.PI / 2);
    expect(b[2]).toMatchObject({ x: 500, y: 290, sx: 10, yaw: 0 });
  });
});
