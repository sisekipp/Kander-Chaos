import { describe, expect, it } from 'vite-plus/test';
import { DgmGrid } from './dgm.ts';

describe('DGM-2-m-Raster', () => {
  it('mittelt die vier 1-m-Punkte um einen geraden Gitterpunkt', () => {
    const g = DgmGrid.create(1000, 2000, 1004, 2004);
    // 1-m-Punkte bei x.5 im Bereich 999.5..1004.5
    for (let e = 999.5; e <= 1004.5; e += 1) for (let n = 1999.5; n <= 2004.5; n += 1) g.accumulate(e, n, e + n);
    g.finalize();
    expect(g.cols).toBe(3);
    // Gitterpunkt (1002, 2002): Punkte 1001.5/1002.5 x 2001.5/2002.5 -> Mittel 3004
    expect(g.sample(1002, 2002)).toBeCloseTo(3004);
    expect(g.holes).toBe(0);
  });

  it('füllt Lücken aus Nachbarn und serialisiert verlustfrei', () => {
    const g = DgmGrid.create(0, 0, 8, 2);
    g.accumulate(0.5, 0.5, 10);
    g.accumulate(0.5, 2.5, 10);
    g.accumulate(8.5, 0.5, 20);
    g.accumulate(8.5, 2.5, 20);
    g.finalize();
    expect(g.holes).toBe(6);
    const r = DgmGrid.deserialize(g.serialize());
    expect(r.sample(0, 0)).toBe(10);
    expect(r.sample(8, 0)).toBe(20);
    expect(r.sample(4, 0)).toBeGreaterThanOrEqual(10);
  });
});
