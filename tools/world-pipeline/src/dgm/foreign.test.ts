import { describe, expect, it } from 'vite-plus/test';
import { toUtm } from '../utm.ts';
import { foreignSampler } from './foreign.ts';
import { TileIndex } from './raster.ts';

const fake = (h: number) => ({ sample: () => h }) as unknown as TileIndex;

describe('ausländische Höhen', () => {
  const basel = toUtm(47.558, 7.588);
  it('Schweiz hat Vorrang, Frankreich ist Rückfall, sonst NaN', () => {
    expect(foreignSampler(fake(260), fake(250))(basel.easting, basel.northing)).toBe(260);
    expect(foreignSampler(fake(NaN), fake(250))(basel.easting, basel.northing)).toBe(250);
    expect(foreignSampler(fake(NaN), fake(NaN))(basel.easting, basel.northing)).toBeNaN();
  });
});
