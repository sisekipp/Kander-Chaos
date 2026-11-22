import { describe, expect, it } from 'vite-plus/test';
import { StreamingPlanner } from './StreamingPlanner.ts';

const all = () => true;
const mk = (extra: Partial<ConstructorParameters<typeof StreamingPlanner>[0]> = {}) =>
  new StreamingPlanner({ tileSize: 250, viewDistance: 900, maxTiles: 80, ...extra }, all);

describe('Streaming-Planer', () => {
  it('Ring 0 = 3x3, Ring 1 = 5x5-Rand, Ring 2 bis zur Sichtweite', () => {
    const p = mk().plan(125, 125);
    expect(p.filter((t) => t.ring === 0)).toHaveLength(9);
    expect(p.filter((t) => t.ring === 1)).toHaveLength(16);
    expect(p.filter((t) => t.ring === 2).length).toBeGreaterThan(0);
    expect(p[0].ring).toBe(0);
  });

  it('Hysterese: kurzes Überschreiten der Grenze wechselt den Anker nicht', () => {
    const pl = mk();
    pl.plan(240, 125);
    pl.plan(265, 125); // 15 m drüber
    expect(pl.anchorTile).toEqual({ tx: 0, tz: 0 });
    pl.plan(290, 125); // 40 m drüber
    expect(pl.anchorTile).toEqual({ tx: 1, tz: 0 });
  });

  it('Obergrenze der Kachelzahl gilt unabhängig von der Weltgröße', () => {
    const p = mk({ viewDistance: 5000, maxTiles: 60 }).plan(0, 0);
    expect(p.length).toBe(60);
  });

  it('bevorzugt Kacheln in Fahrtrichtung und lädt bei hoher Geschwindigkeit voraus', () => {
    const pl = mk();
    const p = pl.plan(125, 125, 22, 0); // 80 km/h nach Osten
    const ahead = p.find((t) => t.id === '2,0')!;
    const behind = p.find((t) => t.id === '-2,0')!;
    expect(ahead.ring).toBe(0);
    expect(behind.ring).toBe(1);
    expect(p.indexOf(ahead)).toBeLessThan(p.indexOf(behind));
  });

  it('simulierte Fahrt: betretene Kachel war vorher bereits Ring 0', () => {
    const pl = mk();
    let prevRing0 = new Set<string>();
    for (let x = 125; x < 3000; x += 22 / 30) {
      const p = pl.plan(x, 125, 22, 0);
      const cur = `${Math.floor(x / 250)},0`;
      if (prevRing0.size) expect(prevRing0.has(cur)).toBe(true);
      prevRing0 = new Set(p.filter((t) => t.ring === 0).map((t) => t.id));
    }
  });

  it('nur existierende Kacheln', () => {
    const pl = new StreamingPlanner({ tileSize: 250, viewDistance: 900, maxTiles: 80 }, (tx) => tx >= 0);
    expect(pl.plan(10, 10).every((t) => t.tx >= 0)).toBe(true);
  });
});
