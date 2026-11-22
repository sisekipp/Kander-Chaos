import { describe, expect, it } from 'vite-plus/test';
import { BuildingType, RoofShape, type Building } from '@kandern/world-format';
import { BUILDING_SHADE_MIN, createShadeSampler } from './bakedShade.ts';

const house: Building = {
  id: 1,
  type: BuildingType.Residential,
  roof: RoofShape.Gabled,
  wallHeight: 6,
  roofHeight: 4,
  levels: 2,
  outline: new Float32Array([100, 100, 110, 100, 110, 108, 100, 108]),
  estimated: false,
};
const tree = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 50, 0, 50, 1]);

describe('eingebackene Verschattung', () => {
  const shade = createShadeSampler([house], [tree]);

  it('Vertex neben dem Gebäude ist dunkler als freie Wiese', () => {
    expect(shade(111, 104)).toBeLessThan(shade(200, 200));
    expect(shade(200, 200)).toBe(1);
    expect(shade(110.01, 104)).toBeCloseTo(BUILDING_SHADE_MIN, 2);
  });

  it('Abdunkelung klingt nach 3 m aus', () => {
    expect(shade(114, 104)).toBe(1);
    expect(shade(112.5, 104)).toBeGreaterThan(shade(111, 104));
  });

  it('unter der Baumkrone dunkler, außerhalb nicht', () => {
    expect(shade(50, 50)).toBeLessThan(0.75);
    expect(shade(51, 50)).toBeGreaterThan(shade(50, 50));
    expect(shade(54, 50)).toBe(1);
  });
});
