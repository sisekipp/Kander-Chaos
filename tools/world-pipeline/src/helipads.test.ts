import { describe, expect, it } from 'vite-plus/test';
import { projectToWorld } from './area.ts';
import { selectHelipads } from './helipads.ts';

describe('Landeplätze', () => {
  it('rechnet um, sortiert und verwirft Plätze außerhalb des Spielgebiets', () => {
    const pads = selectHelipads(
      [
        { id: 'zzz', name: 'weit weg', lat: 48.5, lon: 8.5, heading: 0 },
        { id: 'kandern', name: 'Kandern', lat: 47.70653, lon: 7.65504, heading: 90 },
      ],
      projectToWorld,
      (x, z) => Math.abs(x) < 20000 && Math.abs(z) < 20000,
    );
    expect(pads.map((p) => p.id)).toEqual(['kandern']);
    expect(Math.hypot(pads[0].x, pads[0].z)).toBeLessThan(2000);
    expect(pads[0].heading).toBeCloseTo(Math.PI / 2);
  });
});
