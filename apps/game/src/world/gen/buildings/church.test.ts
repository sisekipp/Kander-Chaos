import { describe, expect, it } from 'vite-plus/test';
import { BuildingType, DEFAULT_HEIGHT_QUANT, RoofShape, emptyDetails, type TileData } from '@kandern/world-format';
import { MIN_TOWER_HEIGHT, NAVE_ROOF_PITCH, naveRoofHeight, towerHeight } from './church.ts';
import { buildBuildings } from './index.ts';

function churchTile(withTower: boolean): TileData {
  const samples = 9;
  const t: TileData = {
    tx: 0,
    tz: 0,
    size: 250,
    quant: DEFAULT_HEIGHT_QUANT,
    lods: [{ samples, heights: new Uint16Array(samples * samples).fill(10000) }], // 350 m
    buildings: [
      {
        id: 77,
        type: BuildingType.Church,
        roof: RoofShape.Gabled,
        wallHeight: 12,
        roofHeight: 6,
        levels: 1,
        outline: new Float32Array([100, 100, 130, 100, 130, 112, 100, 112]),
        estimated: false,
      },
    ],
    roads: [],
    land: [],
    waterways: [],
  };
  if (withTower) {
    t.details = emptyDetails();
    t.details.churchTowers = [{ buildingId: 77, x: 104, z: 106, size: 7, rot: 0 }];
  }
  return t;
}

describe('Kirche', () => {
  it('Satteldach des Schiffs mit 55° Neigung', () => {
    expect(naveRoofHeight(6, 4)).toBeCloseTo(6 * Math.tan((NAVE_ROOF_PITCH * Math.PI) / 180));
    expect(naveRoofHeight(6, 20)).toBe(20);
  });

  it('Turm überragt das Schiff deutlich und ist mindestens 22 m hoch', () => {
    expect(towerHeight(12, 12 + 8.6)).toBeGreaterThanOrEqual(30);
    expect(towerHeight(5, 9)).toBe(MIN_TOWER_HEIGHT);
  });

  it('Turm steht an der Turmlage aus den Kacheldaten und ist höchster Punkt', () => {
    const g = buildBuildings(churchTile(true), { simple: false })!;
    let maxY = -Infinity,
      atX = 0,
      atZ = 0;
    for (let v = 0; v < g.positions.length / 3; v++)
      if (g.positions[v * 3 + 1] > maxY) {
        maxY = g.positions[v * 3 + 1];
        atX = g.positions[v * 3];
        atZ = g.positions[v * 3 + 2];
      }
    expect(atX).toBeCloseTo(104);
    expect(atZ).toBeCloseTo(106);
    const ridge = 350 + 12 + naveRoofHeight(6, 6);
    expect(maxY).toBeGreaterThan(ridge + 10);
  });

  it('ohne Turmdaten bleibt die Kirche ein normales Gebäude', () => {
    const g = buildBuildings(churchTile(false), { simple: false })!;
    let maxY = -Infinity;
    for (let v = 0; v < g.positions.length / 3; v++) maxY = Math.max(maxY, g.positions[v * 3 + 1]);
    expect(maxY).toBeLessThan(350 + 12 + 6 + 1);
  });
});
