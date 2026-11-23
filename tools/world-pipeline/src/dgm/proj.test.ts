import { describe, expect, it } from 'vite-plus/test';
import { toUtm } from '../utm.ts';
import { fromUtm, toLambert93, toLv95 } from './proj.ts';

describe('Koordinaten-Umrechnungen', () => {
  it('UTM -> WGS84 ist die Umkehrung von WGS84 -> UTM (< 1 mm)', () => {
    for (const [lat, lon] of [
      [47.715, 7.66],
      [47.558, 7.588],
      [47.59, 7.529],
      [47.808, 7.63],
    ]) {
      const u = toUtm(lat, lon);
      const back = fromUtm(u.easting, u.northing);
      const again = toUtm(back.lat, back.lon);
      expect(Math.hypot(again.easting - u.easting, again.northing - u.northing)).toBeLessThan(0.001);
      expect(back.lat).toBeCloseTo(lat, 8);
      expect(back.lon).toBeCloseTo(lon, 8);
    }
  });

  it('LV95: Referenzpunkt alte Sternwarte Bern (2 600 000 / 1 200 000) auf ca. 1 m', () => {
    // 46° 57' 3.9" N, 7° 26' 19.1" O
    const p = toLv95(46 + 57 / 60 + 3.9 / 3600, 7 + 26 / 60 + 19.1 / 3600);
    expect(Math.abs(p.e - 2600000)).toBeLessThan(2);
    expect(Math.abs(p.n - 1200000)).toBeLessThan(2);
  });

  it('LV95: Basel liegt bei ca. E 2 611 000, N 1 267 000', () => {
    const p = toLv95(47.558, 7.588);
    expect(p.e).toBeGreaterThan(2610000);
    expect(p.e).toBeLessThan(2613000);
    expect(p.n).toBeGreaterThan(1266000);
    expect(p.n).toBeLessThan(1269000);
  });

  it('Lambert-93: Ursprung (46,5° N, 3° O) und Meridian 3° O', () => {
    const o = toLambert93(46.5, 3);
    expect(o.x).toBeCloseTo(700000, 3);
    expect(o.y).toBeCloseTo(6600000, 3);
    expect(toLambert93(48, 3).x).toBeCloseTo(700000, 3);
    expect(toLambert93(48, 3).y).toBeGreaterThan(6760000);
  });

  it('Lambert-93: EuroAirport liegt bei ca. x 1 040 000, y 6 740 000 (Mulhouse ca. 1 024 000)', () => {
    const p = toLambert93(47.59, 7.529);
    expect(p.x).toBeGreaterThan(1035000);
    expect(p.x).toBeLessThan(1045000);
    expect(p.y).toBeGreaterThan(6730000);
    expect(p.y).toBeLessThan(6750000);
  });
});
