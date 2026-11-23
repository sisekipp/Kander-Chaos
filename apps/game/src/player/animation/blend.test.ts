import { describe, expect, it } from 'vite-plus/test';
import { BLEND_TIME, blendStep, type Weights } from './blend.ts';

const sum = (w: Weights) => Object.values(w).reduce((s, v) => s + (v ?? 0), 0);

describe('Überblendung', () => {
  it('vom Stehen ins Gehen in 0,3 s', () => {
    let w: Weights = { idle: 1 };
    w = blendStep(w, 'walk', BLEND_TIME / 2);
    expect(w.walk).toBeCloseTo(0.5);
    expect(w.idle).toBeCloseTo(0.5);
    w = blendStep(w, 'walk', BLEND_TIME / 2);
    expect(w.walk).toBeCloseTo(1);
    expect(w.idle).toBeUndefined();
  });

  it('Summe bleibt 1, auch bei Zielwechsel mitten in der Überblendung', () => {
    let w: Weights = { idle: 1 };
    w = blendStep(w, 'walk', 0.1);
    w = blendStep(w, 'run', 0.1);
    expect(sum(w)).toBeCloseTo(1);
    expect(w.idle).toBeCloseTo(1 / 3);
    expect(w.walk).toBeUndefined();
    expect(w.run).toBeCloseTo(2 / 3);
    // Stehen ist 0,3 s nach Beginn weg, obwohl das Ziel gewechselt hat
    w = blendStep(w, 'run', 0.1);
    expect(w).toEqual({ run: 1 });
  });

  it('ohne bisherige Gewichte sofort volles Ziel', () => {
    expect(blendStep({}, 'sit', 0.01)).toEqual({ sit: 1 });
  });
});
