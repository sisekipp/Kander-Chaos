import { describe, expect, it } from 'vite-plus/test';
import { LandKind, RoadKind, type PackEntry, type TileData } from '@kandern/world-format';
import { checkBudgets, checkRegion, MB } from './check.ts';

describe('checkBudgets', () => {
  const p = (bytes: number, remote = false) => ({ file: `f${bytes}`, bytes, sha256: '', remote }) as PackEntry;
  it('besteht innerhalb der Budgets', () => {
    expect(checkBudgets([p(20 * MB), p(20 * MB), p(10 * MB, true)]).ok).toBe(true);
  });
  it('schlägt bei Kern, Nachladeregionen oder zu großem Paket fehl', () => {
    expect(checkBudgets([p(20 * MB), p(20 * MB), p(20 * MB), p(20 * MB), p(20 * MB), p(21 * MB)]).ok).toBe(false);
    expect(checkBudgets(Array.from({ length: 40 }, () => p(21 * MB, true))).ok).toBe(false);
    const r = checkBudgets([p(26 * MB, true)]);
    expect(r.ok).toBe(false);
    expect(r.messages[2]).toContain('f' + 26 * MB);
  });
});

describe('checkRegion', () => {
  const tile = (tx: number, tz: number, extra: Partial<TileData>) =>
    ({ tx, tz, size: 250, buildings: [], roads: [], land: [], ...extra }) as TileData;
  const targets = {
    towns: [{ name: 'Basel', x: 125, z: 125 }],
    weil: { x: 125, z: 125 },
    airport: { x: 125, z: 125 },
    roche: { x: 100, z: 100 },
  };
  it('alles vorhanden -> ok', () => {
    const t = tile(0, 0, {
      buildings: Array.from({ length: 60 }, () => ({}) as never),
      roads: [{ kind: RoadKind.Motorway } as never],
      land: [{ kind: LandKind.Runway } as never],
    });
    const r = checkRegion([t], [{ id: 1, x: 120, z: 90, h: 205, w: 30, d: 30 }], targets);
    expect(r.messages.every((m) => m.startsWith('✔'))).toBe(true);
    expect(r.ok).toBe(true);
  });
  it('fehlende Autobahn, Piste und Hochhaus werden gemeldet', () => {
    const r = checkRegion([tile(0, 0, {})], [{ id: 1, x: 120, z: 90, h: 90, w: 30, d: 30 }], targets);
    expect(r.ok).toBe(false);
    expect(r.messages.filter((m) => m.startsWith('✘'))).toHaveLength(4);
  });
});
