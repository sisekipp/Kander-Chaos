import { describe, expect, it } from 'vite-plus/test';
import { PropKind } from '@kandern/world-format';
import { lineSegments, readOsmProps } from './osm.ts';
import type { OverpassResult } from '../osm.ts';

const project = (p: { lat: number; lon: number }): [number, number] => [p.lon, p.lat];

describe('OSM-Straßenmöbel', () => {
  it('zerlegt Zäune in 2,5-m-Felder mit Ausrichtung', () => {
    const s = lineSegments([0, 0, 10, 0], 2.5);
    expect(s.map((p) => p.x)).toEqual([1.25, 3.75, 6.25, 8.75]);
    expect(s[0].rot).toBeCloseTo(Math.PI / 2); // nach Osten
  });

  it('Felder laufen über Knicke hinweg gleichmäßig weiter', () => {
    const s = lineSegments([0, 0, 3, 0, 3, 3], 2);
    expect(s).toHaveLength(3);
    expect(s[1]).toMatchObject({ x: 3, z: 0 });
  });

  it('ordnet Knoten und Wege den Prop-Arten zu', () => {
    const data: OverpassResult = {
      elements: [
        { type: 'node', id: 1, lat: 5, lon: 6, tags: { highway: 'street_lamp' } },
        { type: 'node', id: 2, lat: 0, lon: 0, tags: { amenity: 'waste_basket' } },
        { type: 'node', id: 3, lat: 1, lon: 1, tags: { highway: 'bus_stop' } },
        {
          type: 'way',
          id: 4,
          nodes: [1, 2],
          geometry: [
            { lat: 0, lon: 0 },
            { lat: 0, lon: 5 },
          ],
          tags: { barrier: 'fence' },
        },
        {
          type: 'way',
          id: 5,
          nodes: [1, 2, 3, 4, 1],
          geometry: [
            { lat: 0, lon: 0 },
            { lat: 0, lon: 20 },
            { lat: 20, lon: 20 },
            { lat: 20, lon: 0 },
            { lat: 0, lon: 0 },
          ],
          tags: { amenity: 'parking' },
        },
      ],
    };
    const r = readOsmProps(data, project);
    expect(r.props.find((p) => p.kind === PropKind.Lamp)).toMatchObject({ x: 6, z: 5 });
    expect(r.props.filter((p) => p.kind === PropKind.Fence)).toHaveLength(2);
    expect(r.props.some((p) => p.kind === PropKind.Sign && p.variant === 2)).toBe(true);
    expect(r.anchors).toEqual([{ x: 1, z: 1, kind: 'bus_stop' }]);
    expect(r.lots).toHaveLength(1);
    expect(r.lots[0].ring).toHaveLength(8);
  });
});
