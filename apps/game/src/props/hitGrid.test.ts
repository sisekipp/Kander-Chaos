import { describe, expect, it } from 'vite-plus/test';
import { HitGrid } from './hitGrid.ts';

describe('Trefferraster', () => {
  const g = new HitGrid();
  g.add({ index: 0, x: 10, z: 10, radius: 0.5 });
  g.add({ index: 1, x: 13.9, z: 10, radius: 0.5 }); // Nachbarzelle
  g.add({ index: 2, x: 40, z: 40, radius: 0.5 });

  it('findet Treffer auch über Zellgrenzen', () => {
    expect(
      g
        .query(12, 10, 1.6)
        .map((p) => p.index)
        .sort(),
    ).toEqual([0, 1]);
  });

  it('keine Treffer außerhalb der Radien', () => {
    expect(g.query(10, 12, 1)).toHaveLength(0);
    expect(g.query(40.9, 40, 0.5).map((p) => p.index)).toEqual([2]);
  });

  it('negative Koordinaten', () => {
    const n = new HitGrid();
    n.add({ index: 5, x: -3, z: -7, radius: 0.4 });
    expect(n.query(-3.5, -7, 0.3).map((p) => p.index)).toEqual([5]);
  });
});
