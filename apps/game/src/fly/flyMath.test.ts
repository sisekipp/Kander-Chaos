import { describe, expect, it } from 'vite-plus/test';
import {
  BASE_SPEED,
  FAST_SPEED,
  LOW_MAX_SPEED,
  MAX_ALTITUDE,
  MIN_CLEARANCE,
  maxSpeedAt,
  stepFlight,
  type FlightEnv,
  type FlightInput,
  type FlightState,
} from './flyMath.ts';

const flat: FlightEnv = { groundAt: () => 300, bounds: { minX: -1000, minZ: -1000, maxX: 1000, maxZ: 1000 } };
const idle: FlightInput = { moveX: 0, moveY: 0, up: false, down: false, fast: false, yaw: 0 };
const at = (y: number): FlightState => ({ x: 0, y, z: 0, vx: 0, vy: 0, vz: 0 });

function run(s: FlightState, input: Partial<FlightInput>, seconds: number, env = flat): FlightState {
  for (let t = 0; t < seconds; t += 1 / 60) s = stepFlight(s, { ...idle, ...input }, 1 / 60, env);
  return s;
}

describe('Flug-Rechnung', () => {
  it('fliegt in Blickrichtung waagerecht und erreicht die Grundgeschwindigkeit', () => {
    const s = run(at(350), { moveY: 1, yaw: Math.PI / 2 }, 2); // Blick nach +x
    expect(s.vx).toBeCloseTo(BASE_SPEED, 0);
    expect(Math.abs(s.vz)).toBeLessThan(0.01);
    expect(s.y).toBeCloseTo(350);
  });

  it('seitwärts: rechts vom Blick (Blick +z -> rechts +x)', () => {
    const s = run(at(350), { moveX: 1, yaw: 0 }, 2);
    expect(s.vx).toBeGreaterThan(10);
  });

  it('kommt nach dem Loslassen innerhalb einer Sekunde praktisch zum Stehen', () => {
    let s = run(at(350), { moveY: 1 }, 2);
    s = run(s, {}, 1);
    expect(Math.hypot(s.vx, s.vz)).toBeLessThan(0.3);
  });

  it('Hoch/Runter ändern die Höhe gleichmäßig', () => {
    const s = run(at(350), { up: true }, 3);
    expect(s.y).toBeGreaterThan(370);
    const d = run(s, { down: true }, 2);
    expect(d.y).toBeLessThan(s.y);
  });

  it('Bodenabstand: über einem Hang hebt sich die Kamera auf mindestens 2 m', () => {
    const hill: FlightEnv = { ...flat, groundAt: (x) => 300 + Math.max(0, x) * 0.3 };
    let minClear = Infinity;
    let s = at(305);
    for (let i = 0; i < 300; i++) {
      s = stepFlight(s, { ...idle, moveY: 1, yaw: Math.PI / 2 }, 1 / 60, hill);
      minClear = Math.min(minClear, s.y - hill.groundAt(s.x, s.z));
    }
    expect(minClear).toBeGreaterThanOrEqual(MIN_CLEARANCE - 1e-9);
    expect(run(at(301), { down: true }, 2).y).toBeCloseTo(300 + MIN_CLEARANCE);
  });

  it('Höchsthöhe 400 m über Gelände', () => {
    expect(run(at(650), { up: true, fast: true }, 10).y).toBeCloseTo(300 + MAX_ALTITUDE);
  });

  it('hält am Weltrand an', () => {
    const s = run({ x: 990, y: 350, z: 0, vx: 0, vy: 0, vz: 0 }, { moveY: 1, yaw: Math.PI / 2 }, 3);
    expect(s.x).toBe(1000);
    expect(s.vx).toBe(0);
  });

  it('Höchstgeschwindigkeit nach Höhe: tief höchstens 25 m/s, hoch mit „Schnell“ 50 m/s', () => {
    expect(maxSpeedAt(50, true)).toBe(LOW_MAX_SPEED);
    expect(maxSpeedAt(50, false)).toBe(BASE_SPEED);
    expect(maxSpeedAt(200, true)).toBe(FAST_SPEED);
    const low = run(at(350), { moveY: 1, fast: true }, 3);
    expect(Math.hypot(low.vx, low.vz)).toBeLessThanOrEqual(LOW_MAX_SPEED + 1e-6);
    const high = run(at(550), { moveY: 1, fast: true }, 3);
    expect(Math.hypot(high.vx, high.vz)).toBeGreaterThan(45);
  });

  it('schräger Joystick ist nicht schneller als gerader', () => {
    const s = run(at(350), { moveX: 1, moveY: 1 }, 3);
    expect(Math.hypot(s.vx, s.vz)).toBeLessThanOrEqual(BASE_SPEED + 1e-6);
  });
});
