import { describe, expect, it } from 'vite-plus/test';
import {
  FAST_HIGH,
  FAST_LOW,
  initialHeli,
  MAX_ALTITUDE,
  MIN_CLEARANCE,
  stepHeli,
  type HeliEnv,
  type HeliInput,
  type HeliState,
} from './heliMath.ts';

const flat: HeliEnv = {
  groundAt: () => 100,
  canLand: () => true,
  bounds: { minX: -1e5, minZ: -1e5, maxX: 1e5, maxZ: 1e5 },
};
const idle: HeliInput = { moveX: 0, moveY: 0, up: false, down: false, fast: false, camYaw: 0, engine: true };

function run(s: HeliState, input: Partial<HeliInput>, seconds: number, env = flat): HeliState {
  for (let t = 0; t < seconds; t += 1 / 30) s = stepHeli(s, { ...idle, ...input }, 1 / 30, env);
  return s;
}

const airborne = (alt: number) => ({ ...initialHeli(0, 100 + alt, 0, 0), rotor: 1, grounded: false });

describe('Hubschrauber-Rechnung', () => {
  it('Rotor läuft in 3 s an; vorher hebt er nicht ab', () => {
    const s0 = initialHeli(0, 100, 0, 0);
    const early = run(s0, { up: true }, 1);
    expect(early.y).toBeCloseTo(100);
    const later = run(s0, { up: true }, 4);
    expect(later.rotor).toBeGreaterThan(0.95);
    expect(later.y).toBeGreaterThan(100.5);
  });

  it('Loslassen: nach 2 s praktisch Schwebeflug', () => {
    let s = run(airborne(50), { moveY: 1, fast: true }, 4);
    expect(Math.hypot(s.vx, s.vz)).toBeGreaterThan(20);
    s = run(s, {}, 2);
    expect(Math.hypot(s.vx, s.vz)).toBeLessThan(0.6);
    expect(Math.abs(s.vy)).toBeLessThan(0.2);
  });

  it('Tempo nach Höhe: tief höchstens 30 m/s, hoch bis 60 m/s', () => {
    const low = run(airborne(50), { moveY: 1, fast: true }, 8);
    expect(Math.hypot(low.vx, low.vz)).toBeLessThanOrEqual(FAST_LOW + 1e-6);
    const high = run(airborne(300), { moveY: 1, fast: true }, 8);
    expect(Math.hypot(high.vx, high.vz)).toBeGreaterThan(FAST_LOW + 10);
    expect(Math.hypot(high.vx, high.vz)).toBeLessThanOrEqual(FAST_HIGH + 1e-6);
  });

  it('fliegt in Kamerarichtung, Bug dreht nach, neigt sich nach vorn und legt sich in die Kurve', () => {
    const s = run(airborne(50), { moveY: 1, camYaw: Math.PI / 2 }, 3);
    expect(s.vx).toBeGreaterThan(10);
    expect(Math.abs(s.vz)).toBeLessThan(1);
    expect(s.heading).toBeCloseTo(Math.PI / 2, 1);
    expect(s.pitch).toBeLessThan(-0.05);
    let turning = airborne(50);
    turning = run(turning, { moveY: 1 }, 2);
    turning = run(turning, { moveY: 1, camYaw: 1.2 }, 0.3);
    expect(Math.abs(turning.roll)).toBeGreaterThan(0.05);
  });

  it('Höhengrenzen 1 m (ohne Landefläche) und 600 m', () => {
    const noLand = { ...flat, canLand: () => false };
    const low = run(airborne(10), { down: true }, 10, noLand);
    expect(low.y - 100).toBeCloseTo(MIN_CLEARANCE, 1);
    expect(low.grounded).toBe(false);
    const top = run(airborne(590), { up: true, fast: true }, 10);
    expect(top.y - 100).toBeCloseTo(MAX_ALTITUDE, 1);
  });

  it('Landen: setzt sanft auf (Sinkrate kurz vor dem Boden klein) und steht dann', () => {
    let s = airborne(30);
    let lastVy = 0;
    for (let t = 0; t < 15 && !s.grounded; t += 1 / 30) {
      lastVy = s.vy;
      s = stepHeli(s, { ...idle, down: true }, 1 / 30, flat);
    }
    expect(s.grounded).toBe(true);
    expect(s.y).toBeCloseTo(100);
    expect(Math.abs(lastVy)).toBeLessThan(1.2);
  });

  it('Gelände steigt an: Hubschrauber hebt sich mit (nie unter den Boden)', () => {
    const slope: HeliEnv = { ...flat, groundAt: (_x, z) => 100 + Math.max(0, z) * 0.3 };
    const s = run(airborne(5), { moveY: 1 }, 6, slope);
    expect(s.y).toBeGreaterThanOrEqual(slope.groundAt(s.x, s.z) - 1e-6);
  });
});
