import { describe, expect, it } from 'vite-plus/test';
import { DEFAULT_HEIGHT_QUANT, LandKind, type TileData } from '@kandern/world-format';
import { BED_RADIUS, MAX_EDGE, RIVER_LIFT, bedHeight, buildWaterGeometry, subdivide } from './waterGeometry.ts';

function tile(): TileData {
  const samples = 9;
  return {
    tx: 0,
    tz: 0,
    size: 250,
    quant: DEFAULT_HEIGHT_QUANT,
    lods: [{ samples, heights: new Uint16Array(samples * samples).fill(10000) }],
    buildings: [],
    roads: [],
    land: [
      // Teich 40 × 20 m mit Insel
      {
        kind: LandKind.Water,
        rings: [new Float32Array([10, 10, 50, 10, 50, 30, 10, 30]), new Float32Array([25, 15, 25, 20, 30, 20, 30, 15])],
      },
      { kind: LandKind.Meadow, rings: [new Float32Array([100, 100, 120, 100, 120, 120])] },
    ],
    waterways: [{ kind: 'stream', width: 3, name: 'Kander', points: new Float32Array([0, 200, 250, 200]) }],
  };
}

describe('Wasser-Geometrie', () => {
  it('Bach als Band mit Fließrichtung in uv.y und halber Breite in uv2', () => {
    const g = buildWaterGeometry(tile())!;
    let maxAlong = 0,
      flowing = 0;
    for (let v = 0; v < g.positions.length / 3; v++)
      if (g.uvs2![v * 2 + 1] === 1) {
        flowing++;
        maxAlong = Math.max(maxAlong, g.uvs![v * 2 + 1]);
        expect(g.uvs2![v * 2]).toBe(1.5);
        expect(g.positions[v * 3 + 1]).toBeCloseTo(350 + RIVER_LIFT);
      }
    expect(flowing).toBeGreaterThan(0);
    expect(maxAlong).toBeCloseTo(250);
  });

  it('Teich mit Insel: Fläche ohne die Insel, keine Wiese', () => {
    const g = buildWaterGeometry(tile())!;
    let area = 0;
    for (let t = 0; t < g.indices.length; t += 3) {
      const [i, j, k] = [g.indices[t], g.indices[t + 1], g.indices[t + 2]];
      if (g.uvs2![i * 2 + 1] !== 0) continue;
      const p = g.positions;
      area +=
        Math.abs(
          (p[j * 3] - p[i * 3]) * (p[k * 3 + 2] - p[i * 3 + 2]) - (p[k * 3] - p[i * 3]) * (p[j * 3 + 2] - p[i * 3 + 2]),
        ) / 2;
    }
    expect(area).toBeCloseTo(40 * 20 - 5 * 5, 1);
  });

  it('Kachel ohne Wasser: kein Mesh', () => {
    const t = tile();
    t.land = [];
    t.waterways = [];
    expect(buildWaterGeometry(t)).toBeNull();
  });

  it('Wasserflächen werden auf kurze Kanten unterteilt (folgen dem Gelände), Fläche bleibt gleich', () => {
    let area = 0,
      longest = 0;
    subdivide([0, 0], [40, 0], [0, 30], (a, b, c) => {
      area += Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
      for (const [p, q] of [
        [a, b],
        [b, c],
        [c, a],
      ])
        longest = Math.max(longest, Math.hypot(q[0] - p[0], q[1] - p[1]));
    });
    expect(area).toBeCloseTo(600);
    expect(longest).toBeLessThanOrEqual(MAX_EDGE);
  });

  it('Wasserhöhe folgt dem Flussbett, nicht der Böschung', () => {
    // Tal mit Böschung: Boden bei x = 0 auf 100 m, steigt mit 50 % an
    const ground = (x: number) => 100 + Math.abs(x) * 0.5;
    expect(bedHeight(ground, 0, 0)).toBe(100);
    expect(bedHeight(ground, 6, 0)).toBeCloseTo(100 + (6 - BED_RADIUS) * 0.5);
    expect(bedHeight(ground, 6, 0)).toBeLessThan(ground(6));
  });
});
