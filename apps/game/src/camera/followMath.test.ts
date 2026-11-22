import { describe, expect, it } from 'vite-plus/test';
import { behindAlpha, cameraForwardYaw, chaseAlpha, smoothFactor, wrapAngle, zoomForSpeed } from './followMath.ts';

describe('Kamera-Mathematik', () => {
  it('Winkel normalisieren', () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle((-3 * Math.PI) / 2)).toBeCloseTo(Math.PI / 2);
  });

  it('Kamera hinter dem Fahrzeug blickt in Fahrtrichtung', () => {
    for (const yaw of [0, 0.7, Math.PI / 2, -2.5, Math.PI]) {
      expect(wrapAngle(cameraForwardYaw(behindAlpha(yaw)) - yaw)).toBeCloseTo(0);
    }
  });

  it('Glättung ist bildratenunabhängig', () => {
    const one = smoothFactor(3, 1 / 30);
    const two = 1 - (1 - smoothFactor(3, 1 / 60)) ** 2;
    expect(two).toBeCloseTo(one, 10);
  });

  it('Fahrkamera schwenkt nach dem Loslassen in höchstens 2 s zurück', () => {
    const yaw = 1;
    let a = behindAlpha(yaw) + 1.5; // weit zur Seite gewischt
    let idle = 0;
    const dt = 1 / 30;
    for (let t = 0; t < 2; t += dt) {
      a = chaseAlpha(a, yaw, dt, idle);
      idle += dt;
    }
    expect(Math.abs(wrapAngle(a - behindAlpha(yaw)))).toBeLessThan(0.05);
  });

  it('während des Wischens bleibt die Kamera, wo der Spieler sie hindreht', () => {
    expect(chaseAlpha(0.5, 2, 1 / 30, 0.1)).toBe(0.5);
  });

  it('Zoom wächst mit der Geschwindigkeit, begrenzt', () => {
    expect(zoomForSpeed(0)).toBe(7);
    expect(zoomForSpeed(10)).toBeGreaterThan(7);
    expect(zoomForSpeed(100)).toBe(14);
  });
});
