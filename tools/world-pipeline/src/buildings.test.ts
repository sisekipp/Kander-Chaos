import { describe, expect, it } from 'vite-plus/test';
import { BuildingType, RoofShape } from '@kandern/world-format';
import { classifyBuilding, placeBuildings } from './buildings.ts';

const ctx = { coreFactor: 0 };

describe('Ergänzungsregeln Gebäude', () => {
  it('nutzt OSM-Angaben, wenn vorhanden', () => {
    const c = classifyBuilding(
      1e12 + 5,
      { building: 'house', 'building:levels': '3', 'roof:shape': 'hipped', height: '12', 'roof:height': '3' },
      120,
      5,
      ctx,
    );
    expect(c).toMatchObject({
      type: BuildingType.Residential,
      levels: 3,
      roof: RoofShape.Hipped,
      roofHeight: 3,
      wallHeight: 9,
      estimated: false,
    });
  });

  it('ergänzt fehlende Stockwerke nach Typ und Fläche – deterministisch', () => {
    const a = classifyBuilding(1e12 + 77, { building: 'yes' }, 140, 5, ctx);
    const b = classifyBuilding(1e12 + 77, { building: 'yes' }, 140, 5, ctx);
    expect(a).toEqual(b);
    expect(a.estimated).toBe(true);
    expect(a.levels).toBe(2);
    expect(a.type).toBe(BuildingType.Residential);
    expect(a.wallHeight).toBeCloseTo(2 * 2.9 + 0.4);
  });

  it('kleine building=yes sind Schuppen, Hallen sind flach, Kirchen hoch', () => {
    expect(classifyBuilding(1e12 + 1, { building: 'yes' }, 20, 2, ctx).type).toBe(BuildingType.Shed);
    expect(classifyBuilding(1e12 + 2, { building: 'industrial' }, 3000, 20, ctx).roof).toBe(RoofShape.Flat);
    expect(classifyBuilding(1e12 + 3, { building: 'church' }, 500, 8, ctx).wallHeight).toBeGreaterThanOrEqual(12);
  });

  it('Fachwerk aus Material-Tag oder im Ortskern', () => {
    expect(
      classifyBuilding(1e12 + 4, { building: 'house', 'building:material': 'timber_framing' }, 100, 4, ctx).type,
    ).toBe(BuildingType.HalfTimbered);
    const inCore = Array.from({ length: 200 }, (_, i) =>
      classifyBuilding(1e12 + i, { building: 'house' }, 100, 4, { coreFactor: 1 }),
    );
    const share = inCore.filter((c) => c.type === BuildingType.HalfTimbered).length / inCore.length;
    expect(share).toBeGreaterThan(0.35);
    expect(share).toBeLessThan(0.75);
  });

  it('Dachhöhe aus Gebäudetiefe und Neigung, begrenzt', () => {
    const c = classifyBuilding(1e12 + 9, { building: 'house', 'roof:shape': 'gabled' }, 100, 4, ctx);
    expect(c.roofHeight).toBeCloseTo(4 * Math.tan((40 * Math.PI) / 180), 1);
    expect(classifyBuilding(1e12 + 10, { building: 'house', 'roof:shape': 'gabled' }, 2000, 30, ctx).roofHeight).toBe(
      9,
    );
  });
});

describe('Kachelzuordnung', () => {
  it('Gebäude über einer Kachelgrenze gehört genau einer Kachel (Schwerpunkt)', () => {
    const placed = placeBuildings(
      [{ id: 1e12 + 1, tags: { building: 'house' }, outline: [245, 10, 265, 10, 265, 20, 245, 20] }],
      250,
      () => 0,
    );
    expect(placed).toHaveLength(1);
    expect([placed[0].tx, placed[0].tz]).toEqual([1, 0]);
    expect(placed[0].building.outline[0]).toBeCloseTo(-5);
  });
});
