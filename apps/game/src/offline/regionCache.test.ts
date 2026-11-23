import { describe, expect, it } from 'vite-plus/test';
import { evictionPlan, RegionCache, type CacheLike, type MetaStore, type RegionEntry } from './regionCache.ts';

function fakes() {
  const store = new Map<string, ArrayBuffer>();
  const cache: CacheLike = {
    match: async (k) => (store.has(k) ? new Response(store.get(k)!) : undefined),
    put: async (k, r) => void store.set(k, await r.arrayBuffer()),
    delete: async (k) => store.delete(k),
  };
  let saved: RegionEntry[] = [];
  const meta: MetaStore = { load: () => saved, save: (e) => void (saved = e.map((x) => ({ ...x }))) };
  return { store, cache, meta, saved: () => saved };
}

describe('Zwischenspeicher der Nachladeregionen', () => {
  it('Verdrängung: älteste zuerst, nur so viele wie nötig', () => {
    const e = [
      { file: 'a', bytes: 100, lastVisit: 3 },
      { file: 'b', bytes: 100, lastVisit: 1 },
      { file: 'c', bytes: 100, lastVisit: 2 },
    ];
    expect(evictionPlan(e, 50, 300)).toEqual(['b']);
    expect(evictionPlan(e, 250, 300)).toEqual(['b', 'c', 'a']);
    expect(evictionPlan(e, 0, 300)).toEqual([]);
  });

  it('Budget voll: neue Region verdrängt die am längsten nicht besuchte', async () => {
    const f = fakes();
    let t = 0;
    const rc = new RegionCache(f.cache, f.meta, 250, () => ++t);
    await rc.put('r1', new ArrayBuffer(100));
    await rc.put('r2', new ArrayBuffer(100));
    await rc.get('r1'); // r1 kürzlich besucht -> r2 ist am ältesten
    await rc.put('r3', new ArrayBuffer(100));
    expect(f.store.has('r2')).toBe(false);
    expect(f.store.has('r1')).toBe(true);
    expect(rc.usedBytes).toBe(200);
  });

  it('erneuter Besuch kommt aus dem Speicher; Zeitstempel überleben einen Neustart', async () => {
    const f = fakes();
    const rc = new RegionCache(f.cache, f.meta, 1000, () => 5);
    await rc.put('r1', new ArrayBuffer(10));
    const again = new RegionCache(f.cache, f.meta, 1000, () => 6);
    expect(again.count).toBe(1);
    expect((await again.get('r1'))!.byteLength).toBe(10);
    expect(await again.get('fehlt')).toBeNull();
  });

  it('Leeren entfernt alle Regionen', async () => {
    const f = fakes();
    const rc = new RegionCache(f.cache, f.meta, 1000);
    await rc.put('r1', new ArrayBuffer(10));
    await rc.clear();
    expect(rc.count).toBe(0);
    expect(f.store.size).toBe(0);
  });
});
