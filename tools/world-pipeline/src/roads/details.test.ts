import { describe, expect, it } from 'vite-plus/test';
import { BuildingType, RoadKind, RoofShape, Surface, type TileData } from '@kandern/world-format';
import { addDetailsToTiles } from './details.ts';
import { roadsPerTile, type RawWay, type RoadPart, splitAtJunctions } from './network.ts';

const way = (id: number, nodes: number[], coords: number[], tags: Record<string, string> = {}): RawWay => ({
  id,
  nodes,
  coords,
  tags: { highway: 'residential', ...tags },
});

function tilesFor(ways: RawWay[]) {
  const pieces = splitAtJunctions(ways, () => true);
  const parts = new Map<string, RoadPart[]>();
  const roads = roadsPerTile(pieces, 100, () => true, parts);
  const tiles: TileData[] = [...roads.keys()].sort().map((k) => {
    const [tx, tz] = k.split(',').map(Number);
    return {
      tx,
      tz,
      size: 100,
      quant: { base: 0, step: 0.01 },
      lods: [],
      buildings: [],
      roads: roads.get(k)!,
      land: [],
      waterways: [],
    };
  });
  return { pieces, parts, tiles };
}

describe('Details je Kachel', () => {
  it('T-Kreuzung: Polygon in der Kachel des Knotens, Kürzung nur am Kreuzungsende', () => {
    const { pieces, parts, tiles } = tilesFor([
      way(1, [1, 2, 3], [10, 50, 50, 50, 90, 50]),
      way(2, [2, 4], [50, 50, 50, 90]),
    ]);
    addDetailsToTiles(tiles, { pieces, parts, ground: () => 0, zebras: [{ x: 70, z: 51 }], towerParts: [] });
    const d = tiles[0].details!;
    expect(d.junctions).toHaveLength(1);
    expect(d.roads).toHaveLength(3);
    for (const r of d.roads) {
      expect(r.sidewalkLeft).toBe(true); // im Ort ergänzt
      expect(r.trimStart + r.trimEnd).toBeGreaterThan(0);
      expect(Math.min(r.trimStart, r.trimEnd)).toBe(0);
      expect(Number.isNaN(r.deckStart)).toBe(true);
    }
    expect(d.crossings).toHaveLength(1);
    expect(d.crossings[0].z).toBeCloseTo(50);
  });

  it('Brücke über eine Kachelgrenze: gleiche Deckhöhe auf beiden Seiten', () => {
    const ground = (x: number) => (x > 70 && x < 130 ? 90 : 100);
    const { pieces, parts, tiles } = tilesFor([way(1, [1, 2], [60, 50, 140, 50], { bridge: 'yes' })]);
    addDetailsToTiles(tiles, { pieces, parts, ground, zebras: [], towerParts: [] });
    const [a, b] = tiles.map((t) => t.details!.roads[0]);
    expect(a.deckEnd).toBeCloseTo(b.deckStart, 5);
    expect(a.deckStart).toBeCloseTo(100);
    expect(a.deckEnd).toBeGreaterThanOrEqual(90.5);
    expect(a.surface).toBe(Surface.Asphalt);
  });

  it('Kirchturm im Abschnitt, Kachel-lokal', () => {
    const { pieces, parts, tiles } = tilesFor([way(1, [1, 2], [110, 10, 190, 10])]);
    tiles[0].buildings.push({
      id: 5,
      type: BuildingType.Church,
      roof: RoofShape.Gabled,
      wallHeight: 12,
      roofHeight: 8,
      levels: 1,
      outline: new Float32Array([20, 20, 50, 20, 50, 32, 20, 32]),
      estimated: false,
    });
    const stats = addDetailsToTiles(tiles, { pieces, parts, ground: () => 0, zebras: [], towerParts: [] });
    expect(stats.towers).toBe(1);
    expect(tiles[0].details!.churchTowers[0].x).toBeLessThan(30);
    expect(tiles[0].roads[0].kind).toBe(RoadKind.Residential);
  });
});
