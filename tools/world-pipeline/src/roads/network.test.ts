import { describe, expect, it } from 'vite-plus/test';
import { RoadKind } from '@kandern/world-format';
import { RoadGraph, roadKind, roadsPerTile, splitAtJunctions, type RawWay } from './network.ts';

const way = (id: number, nodes: number[], coords: number[], highway = 'residential'): RawWay => ({
  id,
  nodes,
  coords,
  tags: { highway },
});

describe('Straßennetz', () => {
  it('Typ und Breite', () => {
    expect(roadKind({ highway: 'primary' })).toEqual({ kind: RoadKind.Primary, width: 8 });
    expect(roadKind({ highway: 'residential', width: '4,5' })?.width).toBe(4.5);
    expect(roadKind({ highway: 'bus_stop' })).toBeNull();
    expect(roadKind({ railway: 'rail' })?.kind).toBe(RoadKind.Rail);
  });

  it('teilt Wege an Kreuzungen', () => {
    const pieces = splitAtJunctions([
      way(1, [10, 11, 12], [0, 0, 100, 0, 200, 0]),
      way(2, [11, 20], [100, 0, 100, 100]),
    ]);
    expect(pieces.map((p) => [p.startNode, p.endNode])).toEqual([
      [10, 11],
      [11, 12],
      [11, 20],
    ]);
  });

  it('bleibt über Kachelgrenzen verbunden', () => {
    // Weg von Kachel (0,0) über (1,0) nach (2,0) mit Abzweig in (2,0)
    const pieces = splitAtJunctions([
      way(1, [1, 2], [10, 100, 640, 120]),
      way(2, [2, 3], [640, 120, 700, 240]),
      way(3, [8, 9], [10, 200, 30, 220]), // isoliert
    ]);
    const tiles = roadsPerTile(pieces, 250, () => true);
    expect([...tiles.keys()].sort()).toEqual(['0,0', '1,0', '2,0']);
    const g = new RoadGraph();
    for (const [key, roads] of tiles) {
      const [tx, tz] = key.split(',').map(Number);
      g.addTileRoads(tx, tz, 250, roads);
    }
    expect(g.connected(1, 3)).toBe(true);
    expect(g.connected(1, 9)).toBe(false);
    expect(g.nearest(700, 238)).toBe(3);
  });
});
