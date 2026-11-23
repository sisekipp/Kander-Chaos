import { describe, expect, it } from 'vite-plus/test';
import type { TileData } from '@kandern/world-format';
import { buildSkyline } from './skyline.ts';

const tile = (tx: number, tz: number, b: [number, number, number][]) =>
  ({
    tx,
    tz,
    size: 250,
    buildings: b.map(([id, wall, roof]) => ({
      id,
      wallHeight: wall,
      roofHeight: roof,
      outline: new Float32Array([10, 10, 30, 10, 30, 50, 10, 50]),
    })),
  }) as unknown as TileData;

describe('buildSkyline', () => {
  it('nimmt nur Gebäude ab 40 m, Weltlage und Ausdehnung, höchste zuerst', () => {
    const s = buildSkyline([
      tile(0, 0, [[1, 12, 3]]),
      tile(2, -1, [
        [2, 200, 5],
        [3, 38, 4],
      ]),
    ]);
    expect(s.map((e) => e.id)).toEqual([2, 3]);
    expect(s[0]).toMatchObject({ x: 520, z: -220, h: 205, w: 20, d: 40 });
  });
  it('Gebäude über Kachelgrenzen nur einmal', () => {
    expect(buildSkyline([tile(0, 0, [[7, 50, 0]]), tile(1, 0, [[7, 50, 0]])])).toHaveLength(1);
  });

  it('Wahrzeichen: Sollhöhe ersetzt geschätzte Höhe, ID in der Liste; freie Wahrzeichen per Lage', () => {
    const s = buildSkyline([tile(0, 0, [[9, 20, 0]])], 40, [
      { id: 'roche-1', buildingId: 9, x: 0, z: 0, height: 178 },
      { id: 'tower', buildingId: null, x: 50, z: 60, height: 45, size: [14, 14] },
      { id: 'flugzeug', buildingId: null, x: 0, z: 0, height: 12, size: [36, 40] },
    ]);
    expect(s.map((e) => [e.landmarkId, e.h])).toEqual([
      ['roche-1', 178],
      ['tower', 45],
    ]);
  });
});
