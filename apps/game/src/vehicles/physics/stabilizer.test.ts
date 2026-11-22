import { describe, expect, it } from 'vite-plus/test';
import { rollTorque, targetLean } from './stabilizer.ts';

describe('Zweirad-Stabilisator', () => {
  it('neigt sich in die Kurve, stärker bei Tempo, begrenzt', () => {
    expect(targetLean(0.5, 0, 8, 0.45)).toBe(0);
    expect(targetLean(0.5, 4, 8, 0.45)).toBeGreaterThan(0);
    expect(targetLean(-1, 8, 8, 0.45)).toBeCloseTo(-0.45);
  });

  it('Regler zieht zur Zielneigung und dämpft', () => {
    expect(rollTorque(0.3, 0, 0, 100, 10)).toBeLessThan(0);
    expect(rollTorque(-0.3, 0, 0, 100, 10)).toBeGreaterThan(0);
    expect(rollTorque(0.2, 0, 0.2, 100, 10)).toBeCloseTo(0);
    expect(rollTorque(0, 1, 0, 100, 10)).toBe(-10);
  });

  it('simuliert: aus 30° Schräglage zurück auf aufrecht', () => {
    let roll = 0.5,
      rate = 0;
    const inertia = 20,
      dt = 1 / 60;
    for (let i = 0; i < 180; i++) {
      rate += (rollTorque(roll, rate, 0, 800, 120) / inertia) * dt;
      roll += rate * dt;
    }
    expect(Math.abs(roll)).toBeLessThan(0.02);
  });
});
