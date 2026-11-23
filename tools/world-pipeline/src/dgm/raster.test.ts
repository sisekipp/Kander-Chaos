import { describe, expect, it } from 'vite-plus/test';
import { newestPerTile, parseSwissItem, pieces, sampleTile, TileIndex, type RasterTile } from './raster.ts';

/** 3 × 3 Punkte im 2-m-Abstand, Höhe = x-Index · 10 + Zeile (Nord nach Süd). */
const tile: RasterTile = {
  x0: 1000,
  yTop: 2006,
  step: 2,
  cols: 3,
  rows: 3,
  data: new Float32Array([0, 10, 20, 1, 11, 21, 2, 12, 22]),
  nodataBelow: -1000,
};

describe('Raster fremder Quellen', () => {
  it('tastet Zellmitten exakt und dazwischen bilinear ab', () => {
    expect(sampleTile(tile, 1001, 2005)).toBeCloseTo(0);
    expect(sampleTile(tile, 1005, 2001)).toBeCloseTo(22);
    expect(sampleTile(tile, 1002, 2005)).toBeCloseTo(5);
    expect(sampleTile(tile, 900, 2000)).toBeNaN();
  });

  it('fehlende Werte ergeben NaN', () => {
    const t = { ...tile, data: new Float32Array([-9999, 10, 20, 1, 11, 21, 2, 12, 22]) };
    expect(sampleTile(t, 1001.5, 2004.5)).toBeNaN();
  });

  it('Kachelindex findet die passende Kachel', () => {
    const idx = new TileIndex(6);
    idx.add({ ...tile, x0: 996, yTop: 2004 });
    expect(idx.count).toBe(1);
    expect(idx.sample(997, 2003)).toBeCloseTo(0);
    expect(idx.sample(1100, 2003)).toBeNaN();
  });

  it('swissALTI3D: Name lesen und je Kachel den neuesten Jahrgang wählen', () => {
    expect(parseSwissItem('swissalti3d_2019_2610-1266')).toEqual({
      year: 2019,
      e: 2610000,
      n: 1266000,
      tile: '2610-1266',
    });
    const items = [
      { id: 'swissalti3d_2019_2610-1266' },
      { id: 'swissalti3d_2023_2610-1266' },
      { id: 'swissalti3d_2019_2611-1266' },
    ];
    expect(newestPerTile(items).map((i) => i.id)).toEqual(['swissalti3d_2019_2611-1266', 'swissalti3d_2023_2610-1266']);
  });

  it('Ausschnitte decken das Rechteck auf dem Gitter ab', () => {
    expect(pieces(1500, 0, 4100, 1000, 2000)).toEqual([
      [0, 0],
      [2000, 0],
      [4000, 0],
    ]);
  });
});
