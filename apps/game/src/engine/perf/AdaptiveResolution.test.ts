import { describe, expect, it } from 'vite-plus/test';
import { AdaptiveResolution } from './AdaptiveResolution.ts';
import { detectDefaultQuality } from '../quality.ts';

const feed = (a: AdaptiveResolution, frameMs: number, totalMs: number) => {
  let changed = 0;
  for (let t = 0; t < totalMs; t += frameMs) if (a.update(frameMs)) changed++;
  return changed;
};

describe('Adaptive Auflösung', () => {
  it('senkt nach 3 s unter 28 fps um einen Schritt', () => {
    const a = new AdaptiveResolution({ base: 0.55, min: 0.4 });
    feed(a, 40, 2900); // 25 fps, aber noch keine 3 s
    expect(a.scale).toBe(0.55);
    feed(a, 40, 200);
    expect(a.scale).toBe(0.5);
  });

  it('bleibt bei stabilen 30 fps unverändert', () => {
    const a = new AdaptiveResolution({ base: 0.55, min: 0.4 });
    expect(feed(a, 33, 20000)).toBe(0);
    expect(a.scale).toBe(0.55);
  });

  it('geht nicht unter die Untergrenze', () => {
    const a = new AdaptiveResolution({ base: 0.55, min: 0.4 });
    feed(a, 50, 60000);
    expect(a.scale).toBe(0.4);
  });

  it('hebt bei lange hoher Bildrate wieder bis zur Basis an', () => {
    const a = new AdaptiveResolution({ base: 0.55, min: 0.4 });
    feed(a, 50, 7000);
    expect(a.scale).toBeLessThan(0.55);
    feed(a, 16, 60000);
    expect(a.scale).toBe(0.55);
  });

  it('ignoriert einzelne Riesenhänger', () => {
    const a = new AdaptiveResolution({ base: 0.55, min: 0.4 });
    a.update(5000);
    expect(a.scale).toBe(0.55);
  });
});

describe('Standard-Qualität', () => {
  it('iPad (auch mit Desktop-UA) startet auf Niedrig', () => {
    const ipadDesktopUa =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/16.6 Safari/605.1.15';
    expect(detectDefaultQuality({ userAgent: ipadDesktopUa, maxTouchPoints: 5, hardwareConcurrency: 2 })).toBe('low');
    expect(
      detectDefaultQuality({
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_7 like Mac OS X)',
        maxTouchPoints: 5,
        hardwareConcurrency: 2,
      }),
    ).toBe('low');
  });
  it('starker Desktop startet auf Hoch, schwacher auf Niedrig', () => {
    expect(detectDefaultQuality({ userAgent: 'X11; Linux', maxTouchPoints: 0, hardwareConcurrency: 12 })).toBe('high');
    expect(detectDefaultQuality({ userAgent: 'X11; Linux', maxTouchPoints: 0, hardwareConcurrency: 4 })).toBe('low');
  });
});
