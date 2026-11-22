import { describe, expect, it } from 'vite-plus/test';
import { autopilot, flightRoute, REACH, type FlyWaypoint } from './autopilot.ts';

const at = (x: number, y: number, z: number) => ({ x, y, z, vx: 0, vy: 0, vz: 0 });
const wp = (x: number, z: number, altitude = 50, fast = false): FlyWaypoint => ({ x, z, altitude, fast });

describe('autopilot', () => {
  it('blickt zum Ziel (Gierwinkel 0 = +z) und fliegt vorwärts', () => {
    const r = autopilot(at(0, 50, 0), 0, [wp(0, 100), wp(100, 100)], 0);
    expect(r.input.yaw).toBeCloseTo(0);
    expect(r.input.moveY).toBe(1);
    const east = autopilot(at(0, 50, 0), 0, [wp(100, 0), wp(0, 0)], 0);
    expect(east.input.yaw).toBeCloseTo(Math.PI / 2);
  });

  it('steigt unter der Zielhöhe, sinkt darüber, hält sie in der Toleranz', () => {
    expect(autopilot(at(0, 20, 0), 0, [wp(0, 100, 50)], 0).input.up).toBe(true);
    expect(autopilot(at(0, 90, 0), 0, [wp(0, 100, 50)], 0).input.down).toBe(true);
    const hold = autopilot(at(0, 351, 0), 300, [wp(0, 100, 50)], 0).input;
    expect(hold.up || hold.down).toBe(false);
  });

  it('schaltet beim Erreichen weiter und meldet am Ende fertig', () => {
    const route = [wp(0, 10), wp(0, 200)];
    expect(autopilot(at(0, 50, REACH - 1), 0, route, 0).index).toBe(1);
    const end = autopilot(at(0, 50, 199), 0, route, 1);
    expect(end.done).toBe(true);
    expect(end.input.moveY).toBe(0);
  });

  it('bremst vor dem letzten Wegpunkt ab', () => {
    expect(autopilot(at(0, 50, 180), 0, [wp(0, 200)], 0).input.moveY).toBeLessThan(1);
  });
});

describe('flightRoute', () => {
  it('Runde in 100 m, Schnellflug in 150 m zum Dorf, Tiefflug in 30 m zurück', () => {
    const r = flightRoute({ x: 0, z: 0 }, { x: 0, z: -5000 });
    expect(r.slice(0, 5).every((p) => p.altitude === 100 && p.fast)).toBe(true);
    expect(r[5]).toEqual({ x: 0, z: -5000, altitude: 150, fast: true });
    expect(r[6]).toEqual({ x: 0, z: 0, altitude: 30, fast: true });
  });
});
