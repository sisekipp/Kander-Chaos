import { describe, expect, it } from 'vite-plus/test';
import { RoadKind, Surface } from '@kandern/world-format';
import { buildRoundabouts, fitCircle } from './roundabouts.ts';
import type { WayPiece } from './network.ts';

const attrs = (roundabout: boolean) => ({
  lanes: 1,
  oneway: roundabout,
  sidewalkLeft: false,
  sidewalkRight: false,
  surface: Surface.Asphalt,
  layer: 0,
  roundabout,
});

/** Ring mit Radius 15 um (100, 200) aus vier Viertelbögen; Knoten 1–4 bei 0°, 90°, 180°, 270°. */
function ringPieces(): WayPiece[] {
  const pieces: WayPiece[] = [];
  for (let q = 0; q < 4; q++) {
    const coords: number[] = [];
    for (let k = 0; k <= 4; k++) {
      const a = ((q + k / 4) * Math.PI) / 2;
      coords.push(100 + Math.cos(a) * 15, 200 + Math.sin(a) * 15);
    }
    pieces.push({
      id: (10 + q) * 1000,
      kind: RoadKind.Primary,
      width: 7,
      coords,
      startNode: q + 1,
      endNode: ((q + 1) % 4) + 1,
      name: '',
      bridge: false,
      tunnel: false,
      attrs: attrs(true),
    });
  }
  return pieces;
}

describe('Kreisverkehre', () => {
  it('Kreis wird aus den Ringpunkten genau eingepasst', () => {
    const c = fitCircle(ringPieces().flatMap((p) => p.coords));
    expect(c.x).toBeCloseTo(100, 3);
    expect(c.z).toBeCloseTo(200, 3);
    expect(c.r).toBeCloseTo(15, 3);
  });

  it('Zufahrt wird bis knapp an den Außenrand gekürzt', () => {
    const entry: WayPiece = {
      id: 50_000,
      kind: RoadKind.Residential,
      width: 6,
      coords: [115, 200, 160, 200], // beginnt am Ringknoten 1 (0°) und führt nach Osten
      startNode: 1,
      endNode: 99,
      name: '',
      bridge: false,
      tunnel: false,
      attrs: attrs(false),
    };
    const { shapes, trims } = buildRoundabouts([...ringPieces(), entry]);
    expect(shapes).toHaveLength(1);
    expect(shapes[0].width).toBe(7);
    expect(shapes[0].nodes).toEqual(new Set([1, 2, 3, 4]));
    // Außenrand bei 15 + 3,5 = 18,5 m, abzüglich 0,3 m Überlappung -> 3,2 m ab Knoten
    expect(trims.get(50_000)!.start).toBeCloseTo(3.2, 3);
    expect(trims.get(50_000)!.end).toBeUndefined();
  });

  it('zu kleine Ringe (Wendeschleifen) werden nicht als Kreisverkehr gezeichnet', () => {
    const tiny = ringPieces().map((p) => ({
      ...p,
      coords: p.coords.map((v, i) => (i % 2 ? 200 + (v - 200) / 6 : 100 + (v - 100) / 6)),
    }));
    expect(buildRoundabouts(tiny).shapes).toHaveLength(0);
  });
});
