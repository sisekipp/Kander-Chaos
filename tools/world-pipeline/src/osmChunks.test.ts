import { describe, expect, it } from 'vite-plus/test';
import { chunkBoxes, mergeElements } from './osmChunks.ts';

describe('OSM-Teilstücke', () => {
  const bb = { minlat: 47.6586, minlon: 7.5696, maxlat: 47.7478, maxlon: 7.7183 };
  it('2-km-Raster ergibt dieselben 42 Teilstücke wie der bisherige Abruf', () => {
    expect(chunkBoxes(bb, 500, 2)).toHaveLength(42);
  });
  it('größere Teilstücke für dünne Daten, lückenlos', () => {
    const c = chunkBoxes(bb, 500, 4);
    expect(c.length).toBeLessThan(15);
    expect(Math.min(...c.map((b) => b[0]))).toBeLessThan(bb.minlat);
    expect(Math.max(...c.map((b) => b[2]))).toBeGreaterThan(bb.maxlat);
  });
  it('führt dedupliziert und stabil sortiert zusammen', () => {
    const m = mergeElements([
      {
        elements: [
          { type: 'way', id: 5, nodes: [], geometry: [] },
          { type: 'node', id: 9, lat: 0, lon: 0 },
        ],
      },
      {
        osm3s: { timestamp_osm_base: '2026-11-22T00:00:00Z' },
        elements: [
          { type: 'node', id: 9, lat: 0, lon: 0 },
          { type: 'node', id: 2, lat: 0, lon: 0 },
        ],
      },
    ]);
    expect(m.elements.map((e) => `${e.type}/${e.id}`)).toEqual(['node/2', 'node/9', 'way/5']);
    expect(m.osm3s?.timestamp_osm_base).toBe('2026-11-22T00:00:00Z');
  });
});
