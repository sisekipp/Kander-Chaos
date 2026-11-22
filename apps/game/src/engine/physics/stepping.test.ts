import { describe, expect, it } from 'vite-plus/test';
import { clampAccumulator } from './stepping.ts';

/** Simuliert Babylons Schleife: while (acc > step) { step; acc -= step } */
function simulate(frames: number[], stepMs = 1000 / 60, maxSteps = 2) {
  let acc = 0;
  const steps: number[] = [];
  for (const f of frames) {
    acc = clampAccumulator(acc, f, stepMs, maxSteps) + f;
    let n = 0;
    while (acc > stepMs) {
      acc -= stepMs;
      n++;
    }
    steps.push(n);
  }
  return steps;
}

describe('feste Physik-Teilschritte', () => {
  it('bei 30 fps zwei Schritte je Bild', () => {
    const s = simulate(Array(30).fill(1000 / 30));
    expect(Math.max(...s)).toBe(2);
    expect(s.slice(5).reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(48); // ≈ 60 Schritte pro Sekunde
  });

  it('bei 60 fps ein Schritt je Bild', () => {
    const s = simulate(Array(60).fill(1000 / 60 + 0.01));
    expect(s.slice(2).every((n) => n <= 2)).toBe(true);
    expect(s.slice(2).filter((n) => n === 1).length).toBeGreaterThan(50);
  });

  it('nie mehr als 2 Schritte, auch bei Hängern', () => {
    const s = simulate([16, 250, 16, 100, 500, 33]);
    expect(Math.max(...s)).toBeLessThanOrEqual(2);
  });
});
