import { describe, expect, it } from 'vite-plus/test';
import {
  HORIZON,
  SUN_DIR,
  ZENITH,
  fogFactor,
  lightAt,
  shade,
  skyGradient,
  toneMap,
  wrapDiffuse,
  type RGB,
} from './skyColors.ts';

const close = (a: RGB, b: RGB) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 6));
const lum = (c: RGB) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

describe('Farben und Kurven', () => {
  it('Tone-Mapping lässt dunkle und mittlere Töne fast unverändert', () => {
    const c = toneMap([0.4, 0.3, 0.2]);
    expect(c[0]).toBeCloseTo(0.36, 2);
    expect(c[1] - c[2]).toBeCloseTo(0.1, 5);
  });

  it('Tone-Mapping begrenzt helle Werte weich und monoton auf ≤ 1', () => {
    let prev = 0;
    for (let v = 0; v <= 4; v += 0.1) {
      const y = toneMap([v, v, v])[0];
      expect(y).toBeLessThanOrEqual(1);
      expect(y).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = y;
    }
  });

  it('weiße Fassade in der Sonne bleibt hell (kein Grauschleier wie bei ACES)', () => {
    const sunFacing: RGB = [-SUN_DIR[0], 0, -SUN_DIR[2]];
    const l = Math.hypot(sunFacing[0], sunFacing[2]);
    const c = shade([0.95, 0.94, 0.9], [sunFacing[0] / l, 0, sunFacing[2] / l], 10, 400, 1500);
    // Zum Vergleich: ACES landet bei gleicher Eingangshelligkeit bei etwa 0,75 (Grauschleier)
    expect(lum(c)).toBeGreaterThan(0.85);
    expect(Math.min(...c)).toBeGreaterThan(0.75);
  });

  it('Schattenseite ist dunkler, aber nicht schwarz (Wrap + Hemisphäre)', () => {
    const away: RGB = [SUN_DIR[0], 0, SUN_DIR[2]];
    const l = Math.hypot(away[0], away[2]);
    const lit = lightAt([away[0] / l, 0, away[2] / l]);
    expect(lum(lit)).toBeGreaterThan(0.35);
    expect(lum(lit)).toBeLessThan(lum(lightAt([0, 1, 0])));
    expect(wrapDiffuse(-1)).toBe(0);
    expect(wrapDiffuse(0)).toBeGreaterThan(0.2);
  });

  it('Nebel endet genau in der Horizontfarbe', () => {
    close(shade([0.2, 0.5, 0.2], [0, 1, 0], 5000, 400, 1500), HORIZON);
    expect(fogFactor(400, 400, 1500)).toBe(0);
    expect(fogFactor(950, 400, 1500)).toBeCloseTo(0.5);
  });

  it('Himmelsverlauf: Horizont unten, Zenit oben', () => {
    close(skyGradient(-0.5), HORIZON);
    close(skyGradient(0), HORIZON);
    close(skyGradient(1), ZENITH);
    expect(skyGradient(0.25)[2]).toBeGreaterThan(Math.min(HORIZON[2], ZENITH[2]) - 1e-9);
  });
});
