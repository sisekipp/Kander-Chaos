import { describe, expect, it } from 'vite-plus/test';
import { firstFreeSpot, landingCandidates } from './landing.ts';

describe('Landeplatz', () => {
  it('Kandidaten: Stelle selbst zuerst, dann Ringe bis 16 m', () => {
    const c = landingCandidates(10, 20);
    expect(c[0]).toEqual({ x: 10, z: 20 });
    expect(c).toHaveLength(33);
    expect(Math.hypot(c[32].x - 10, c[32].z - 20)).toBeCloseTo(16);
  });

  it('freie Stelle wird direkt genommen', () => {
    expect(
      firstFreeSpot(
        0,
        0,
        () => 300,
        () => 300,
      ),
    ).toEqual({ x: 0, z: 0 });
  });

  it('auf einem Haus (10 × 10 m um den Ursprung) wird die nächste freie Stelle daneben gewählt', () => {
    const house = (x: number, z: number) => (Math.abs(x) < 5 && Math.abs(z) < 5 ? 309 : 300);
    const s = firstFreeSpot(0, 0, () => 300, house);
    expect(Math.abs(s.x) >= 5 || Math.abs(s.z) >= 5).toBe(true);
    expect(Math.hypot(s.x, s.z)).toBeLessThanOrEqual(8 + 1e-9);
  });
});
