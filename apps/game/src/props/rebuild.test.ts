import { describe, expect, it } from 'vite-plus/test';
import { RebuildTracker } from './rebuild.ts';

describe('Wiederaufbau', () => {
  it('erst nach 60 s außer Sicht', () => {
    const r = new RebuildTracker();
    r.markDestroyed(4, 0, 0, 0);
    expect(r.update(10, 0, 30_000)).toEqual([]); // in Sicht
    expect(r.update(500, 0, 60_000)).toEqual([]); // erst 30 s außer Sicht
    expect(r.update(500, 0, 89_999)).toEqual([]);
    expect(r.update(500, 0, 90_000)).toEqual([4]);
    expect(r.isDestroyed(4)).toBe(false);
  });

  it('solange in Sicht, bleibt es zerstört', () => {
    const r = new RebuildTracker();
    r.markDestroyed(1, 0, 0, 0);
    for (let t = 0; t <= 300_000; t += 10_000) expect(r.update(20, 20, t)).toEqual([]);
    expect(r.count).toBe(1);
  });
});
