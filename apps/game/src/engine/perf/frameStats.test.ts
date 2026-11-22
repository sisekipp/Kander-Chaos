import { describe, expect, it } from 'vite-plus/test';
import { percentile, summarizeFrames } from './frameStats.ts';

describe('Bildzeit-Statistik', () => {
  it('berechnet Perzentile per Nearest-Rank', () => {
    const v = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(v, 99)).toBe(99);
    expect(percentile(v, 50)).toBe(50);
    expect(percentile(v, 100)).toBe(100);
    expect(percentile([], 99)).toBe(0);
  });

  it('fasst einen Messlauf zusammen', () => {
    // 98 Bilder à 30 ms, 1 Bild 50 ms, 1 Bild 120 ms
    const frames = [...Array(98).fill(30), 50, 120];
    const s = summarizeFrames(frames);
    expect(s.frames).toBe(100);
    expect(s.durationMs).toBe(98 * 30 + 170);
    expect(s.avgFps).toBeCloseTo(100_000 / 3110, 5);
    expect(s.p99FrameMs).toBe(50);
    expect(s.p1LowFps).toBe(20);
    expect(s.maxFrameMs).toBe(120);
    expect(s.framesOver100ms).toBe(1);
  });

  it('kommt mit leeren Läufen zurecht', () => {
    expect(summarizeFrames([]).avgFps).toBe(0);
  });
});
