import { describe, expect, it } from 'vite-plus/test';
import { CAR_PAINTS, paintFor, pickFor } from './palette.ts';

describe('Farbwahl je ID', () => {
  it('ist deterministisch', () => {
    for (const id of [1, 42, 3e12 + 17]) expect(paintFor(id)).toEqual(paintFor(id));
  });

  it('nutzt die ganze Palette und verteilt einigermaßen gleichmäßig', () => {
    const counts = new Map<string, number>();
    for (let id = 1; id <= 6000; id++) {
      const k = paintFor(1e12 + id * 7919).join();
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    expect(counts.size).toBe(CAR_PAINTS.length);
    for (const n of counts.values()) expect(n).toBeGreaterThan(6000 / CAR_PAINTS.length / 2);
  });

  it('gleiches Modell, andere Farben: verschiedene IDs ergeben verschiedene Lacke', () => {
    const colors = new Set([101, 102, 103, 104, 105, 106].map((id) => paintFor(id * 977).join()));
    expect(colors.size).toBeGreaterThan(1);
  });

  it('unabhängige Auswahl über salt (z. B. Modell und Farbe)', () => {
    const list = ['a', 'b', 'c', 'd'];
    const same = [1, 2, 3, 4, 5, 6, 7, 8].filter((id) => pickFor(id, list, 1) === pickFor(id, list, 2)).length;
    expect(same).toBeLessThan(8);
  });
});
