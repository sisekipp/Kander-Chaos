import { describe, expect, it } from 'vite-plus/test';
import { brakeForce, dragForce, driveForce, lateralForce, pedalsFrom, steerAngle, suspensionForce } from './forces.ts';

describe('Fahrzeugkräfte', () => {
  it('Federkraft: Feder + Dämpfer, nie ziehend, ohne Kontakt 0', () => {
    expect(suspensionForce(0.1, 0, 30000, 3000)).toBe(3000);
    expect(suspensionForce(0.1, 0.5, 30000, 3000)).toBe(4500);
    expect(suspensionForce(0.1, -5, 30000, 3000)).toBe(0);
    expect(suspensionForce(-0.1, 1, 30000, 3000)).toBe(0);
  });

  it('Antrieb bleibt lange stark und fällt erst kurz vor v_max auf 0', () => {
    expect(driveForce(1, 0, 22, 7000, 4)).toBe(7000);
    expect(driveForce(1, 11, 22, 7000, 4)).toBeCloseTo(7000 * (1 - 0.125));
    expect(driveForce(1, 22, 22, 7000, 4)).toBe(0);
    expect(driveForce(1, 30, 22, 7000, 4)).toBe(0);
  });

  it('Gleichgewicht Antrieb/Widerstand liegt nahe v_max (Spec: ±15 %)', () => {
    let v = 0;
    for (let i = 0; i < 6000; i++) v += ((driveForce(1, v, 22.2, 7200, 4) + dragForce(v, 1000)) / 1000) * 0.01;
    expect(v).toBeGreaterThan(22.2 * 0.9);
    expect(v).toBeLessThan(22.2);
  });

  it('Rückwärts ist begrenzt', () => {
    expect(driveForce(-1, 0, 22, 7000, 4)).toBe(-3500);
    expect(driveForce(-1, -4, 22, 7000, 4)).toBeCloseTo(0);
  });

  it('Lenkwinkel nimmt mit dem Tempo ab', () => {
    expect(steerAngle(1, 0, 22, 0.6)).toBeCloseTo(0.6);
    expect(steerAngle(1, 22, 22, 0.6)).toBeCloseTo(0.24);
    expect(steerAngle(-2, 0, 22, 0.6)).toBeCloseTo(-0.6);
  });

  it('Seitenhalt wirkt entgegen und ist durch die Radlast begrenzt', () => {
    expect(lateralForce(1, 9, 3000, 250)).toBeCloseTo(-2250);
    expect(lateralForce(10, 9, 3000, 250)).toBeCloseTo(-3600);
    expect(lateralForce(10, 9, 0, 250)).toBeCloseTo(0);
  });

  it('Bremse wirkt entgegen, im Stand nicht', () => {
    expect(brakeForce(10, 1, 9000)).toBe(-9000);
    expect(brakeForce(-10, 1, 9000)).toBe(9000);
    expect(brakeForce(0, 1, 9000)).toBe(0);
  });

  it('Fahrzeug rollt ohne Gas aus, im Stand keine Kraft', () => {
    expect(dragForce(10, 1000)).toBeLessThan(0);
    expect(dragForce(-10, 1000)).toBeGreaterThan(0);
    expect(dragForce(0, 1000)).toBe(-0);
  });

  it('Bremse im Stand wird zum Rückwärtsgang', () => {
    expect(pedalsFrom(0, 1, 0)).toEqual({ throttle: -1, brake: 0 });
    expect(pedalsFrom(0, 1, 10)).toEqual({ throttle: 0, brake: 1 });
    expect(pedalsFrom(1, 0, -3)).toEqual({ throttle: 0, brake: 1 });
  });
});
