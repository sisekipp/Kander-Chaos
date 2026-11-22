import { describe, expect, it } from 'vite-plus/test';
import { buildAttribution } from './attribution.ts';

describe('Quellennachweis', () => {
  it('enthält OSM (ODbL) und LGL BW (Datenlizenz Deutschland) mit Abrufdatum', () => {
    const a = buildAttribution('2026-11-22', '2026-11-22');
    const osm = a.sources.find((s) => s.id === 'osm')!;
    const lgl = a.sources.find((s) => s.id === 'lgl-dgm1')!;
    expect(osm.attribution).toBe('© OpenStreetMap-Mitwirkende');
    expect(osm.license).toMatch(/ODbL/);
    expect(lgl.license).toMatch(/Datenlizenz Deutschland/);
    expect(lgl.attribution).toMatch(/LGL/);
    expect(osm.retrieved).toBe('2026-11-22');
  });
});
