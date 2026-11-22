import { describe, expect, it } from 'vite-plus/test';
import { RoadKind, Surface } from '@kandern/world-format';
import { isZebra, placeCrossings } from './crossings.ts';
import type { WayPiece } from './network.ts';

const road = (kind: RoadKind, coords: number[], width = 7): WayPiece => ({
  id: 1000,
  kind,
  width,
  coords,
  startNode: 1,
  endNode: 2,
  name: '',
  bridge: false,
  tunnel: false,
  attrs: {
    lanes: 2,
    oneway: false,
    sidewalkLeft: true,
    sidewalkRight: true,
    surface: Surface.Asphalt,
    layer: 0,
    roundabout: false,
  },
});

describe('Zebrastreifen', () => {
  it('erkennt Zebrastreifen an den üblichen Tags', () => {
    expect(isZebra({ highway: 'crossing', crossing: 'zebra' })).toBe(true);
    expect(isZebra({ highway: 'crossing', crossing: 'uncontrolled', crossing_ref: 'zebra' })).toBe(true);
    expect(isZebra({ highway: 'crossing', crossing: 'marked' })).toBe(true);
    expect(isZebra({ highway: 'crossing', 'crossing:markings': 'zebra' })).toBe(true);
    expect(isZebra({ highway: 'crossing', crossing: 'unmarked' })).toBe(false);
    expect(isZebra({ highway: 'crossing', crossing: 'traffic_signals' })).toBe(false);
    expect(isZebra({ highway: 'crossing' })).toBe(false);
    expect(isZebra({ highway: 'street_lamp', crossing: 'zebra' })).toBe(false);
  });

  it('Position auf der Achse, Laufrichtung quer zur Straße, Länge = Fahrbahnbreite', () => {
    const [c] = placeCrossings([{ x: 50, z: 1.5 }], [road(RoadKind.Primary, [0, 0, 100, 0], 8)]);
    expect(c.x).toBeCloseTo(50);
    expect(c.z).toBeCloseTo(0);
    expect(Math.abs(c.dirZ)).toBeCloseTo(1);
    expect(c.dirX).toBeCloseTo(0);
    expect(c.length).toBe(8);
  });

  it('wählt die nächste Fahrbahn und ignoriert Fußwege und ferne Knoten', () => {
    const pieces = [road(RoadKind.Footway, [0, 1, 100, 1], 2), road(RoadKind.Residential, [0, 3, 100, 3], 5)];
    const [c] = placeCrossings([{ x: 20, z: 1 }], pieces);
    expect(c.z).toBeCloseTo(3);
    expect(c.length).toBe(5);
    expect(placeCrossings([{ x: 20, z: 30 }], pieces)).toEqual([]);
  });
});
