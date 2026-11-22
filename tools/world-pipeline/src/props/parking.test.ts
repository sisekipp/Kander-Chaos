import { describe, expect, it } from 'vite-plus/test';
import { RoadKind, VehicleKind } from '@kandern/world-format';
import { ConflictMap } from './conflicts.ts';
import { JUNCTION_CLEARANCE, MIN_SPACING, placeParking } from './parking.ts';
import { propTile } from './testFixtures.ts';

function run(lots = [] as { id: number; ring: number[] }[]) {
  const tile = propTile();
  // lange Wohnstraße mit echter Kreuzung am Anfang (Knoten 1) und Kachelschnitt am Ende
  tile.roads = [
    {
      id: 9001,
      kind: RoadKind.Residential,
      width: 5,
      points: new Float32Array([0, 30, 250, 30]),
      startNode: 1,
      endNode: 4e15 + 5,
      name: '',
      bridge: false,
      tunnel: false,
    },
  ];
  tile.buildings = [];
  const map = new ConflictMap(0, 0, 250);
  map.addTile(tile);
  const ref = new ConflictMap(0, 0, 250);
  ref.addTile(tile);
  return { spots: placeParking(tile, map, lots), ref };
}

describe('Parkpositionen', () => {
  it('ist deterministisch und hält Abstände ein', () => {
    const { spots } = run();
    expect(spots).toEqual(run().spots);
    expect(spots.length).toBeGreaterThanOrEqual(3); // ~25 % von ~30 Kandidaten, abzüglich Kreuzungsabstand
    for (let i = 0; i < spots.length; i++)
      for (let j = i + 1; j < spots.length; j++) {
        expect(Math.hypot(spots[i].x - spots[j].x, spots[i].z - spots[j].z)).toBeGreaterThanOrEqual(MIN_SPACING);
      }
  });

  it('nicht näher als 15 m an einer echten Kreuzung, Kachelschnitte zählen nicht', () => {
    const { spots } = run();
    for (const s of spots) expect(Math.hypot(s.x - 0, s.z - 30)).toBeGreaterThanOrEqual(JUNCTION_CLEARANCE);
    expect(spots.some((s) => s.x > 235)).toBe(true); // nahe am Schnitt bei x=250 erlaubt
  });

  it('stehen neben der Fahrbahn, nicht darauf, und in Fahrtrichtung', () => {
    const { spots, ref } = run();
    for (const s of spots) {
      expect(Math.abs(s.z - 30)).toBeCloseTo(2.5 + 1.3, 1);
      expect(ref.isFree(s.x, s.z, 0.6)).toBe(true);
      expect(Math.abs(Math.abs(s.heading) - Math.PI / 2)).toBeLessThan(1e-6); // entlang x
    }
  });

  it('füllt Parkplatzflächen als Raster, IDs eindeutig', () => {
    const { spots } = run([{ id: 2e12 + 1, ring: [150, 100, 200, 100, 200, 130, 150, 130] }]);
    const lot = spots.filter((s) => s.z > 90);
    expect(lot.length).toBeGreaterThan(5);
    expect(new Set(spots.map((s) => s.id)).size).toBe(spots.length);
    expect(Object.values(VehicleKind)).toContain(lot[0].kind);
  });
});
