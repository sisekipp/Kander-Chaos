import { describe, expect, it } from 'vite-plus/test';
import { RouteFollower } from './route.ts';

describe('Messroute', () => {
  it('folgt Wegpunkten mit konstanter Geschwindigkeit und endet am Ziel', () => {
    const r = new RouteFollower(
      [
        [0, 0],
        [100, 0],
        [100, 50],
      ],
      10,
    );
    let p = r.step(5);
    expect(p.x).toBeCloseTo(50);
    expect(p.vx).toBeCloseTo(10);
    p = r.step(6);
    expect(p.x).toBeCloseTo(100);
    expect(p.z).toBeCloseTo(10);
    p = r.step(100);
    expect(r.done).toBe(true);
    expect([p.x, p.z]).toEqual([100, 50]);
  });
});
