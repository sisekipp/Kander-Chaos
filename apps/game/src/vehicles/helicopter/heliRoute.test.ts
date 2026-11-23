import { describe, expect, it } from 'vite-plus/test';
import { heliBaselRoute } from './heliRoute.ts';

describe('heliBaselRoute', () => {
  const pads = [
    { id: 'basel', x: -5600, z: -16700 },
    { id: 'kandern', x: -500, z: -800 },
    { id: 'euroairport', x: -10600, z: -12200 },
    { id: 'loerrach', x: -500, z: -11400 },
  ];
  it('Kandern -> Lörrach -> Basel -> EuroAirport, schnell in 150 m, Anflug in 40 m', () => {
    const r = heliBaselRoute(pads)!;
    expect(r).toHaveLength(4);
    expect(r[0]).toMatchObject({ altitude: 150, fast: false });
    expect(r.slice(1).map((w) => [w.x, w.z])).toEqual([
      [-500, -11400],
      [-5600, -16700],
      [-10600, -12200],
    ]);
    expect(r[3].altitude).toBe(40);
  });
  it('fehlt ein Landeplatz -> keine Route', () => {
    expect(heliBaselRoute(pads.slice(1))).toBeNull();
  });
});
