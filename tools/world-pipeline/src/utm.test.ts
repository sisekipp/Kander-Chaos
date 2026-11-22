import { describe, expect, it } from 'vite-plus/test';
import { toUtm } from './utm.ts';

describe('UTM 32N', () => {
  it('Mittelmeridian 9° ergibt Easting 500000', () => {
    expect(toUtm(47.7, 9).easting).toBeCloseTo(500000, 6);
  });
  it('Äquator ergibt Northing 0', () => {
    expect(toUtm(0, 9).northing).toBeCloseTo(0, 6);
  });
  it('Meridianbogen bei 45° (GRS80: 4 984 944,38 m) x k0', () => {
    expect(toUtm(45, 9).northing).toBeCloseTo(0.9996 * 4984944.378, 0);
  });
  it('Kandern liegt im Bereich der LGL-Kachel 399/5284 (Größenordnung)', () => {
    const u = toUtm(47.7136, 7.6627);
    expect(u.easting).toBeGreaterThan(398000);
    expect(u.easting).toBeLessThan(404000);
    expect(u.northing).toBeGreaterThan(5282000);
    expect(u.northing).toBeLessThan(5290000);
  });
});
