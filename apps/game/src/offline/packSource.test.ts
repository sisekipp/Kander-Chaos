import { describe, expect, it } from 'vite-plus/test';
import type { WorldIndex } from '@kandern/world-format';
import { PackSource, type PackStore } from './packSource.ts';

const bytes = (n: number, v: number) => new Uint8Array(n).fill(v).buffer;
const index = {
  packs: [
    { file: 'core.bin', bytes: 4, sha256: 'h4' },
    { file: 'a.bin', bytes: 4, sha256: 'h4', remote: true },
    { file: 'b.bin', bytes: 4, sha256: 'h4', remote: true },
    { file: 'c.bin', bytes: 4, sha256: 'h4', remote: true },
    { file: 'd.bin', bytes: 4, sha256: 'h4', remote: true },
  ],
} as unknown as WorldIndex;

function setup(opts: { fail?: string[]; store?: Map<string, ArrayBuffer> } = {}) {
  const store = opts.store ?? new Map<string, ArrayBuffer>();
  const calls: string[] = [];
  const pending: (() => void)[] = [];
  let t = 0;
  const src = new PackSource(index, 'https://r2.test/w/', {
    fetch: (url) =>
      new Promise((res) => {
        calls.push(url);
        const fail = opts.fail?.some((f) => url.endsWith(f));
        pending.push(() => res({ ok: !fail, status: fail ? 404 : 200, arrayBuffer: async () => bytes(4, 7) }));
      }),
    store: { get: async (f) => store.get(f) ?? null, put: async (f, d) => void store.set(f, d) } as PackStore,
    sha256: async (b) => `h${b.length}`,
    now: () => t,
    retryMs: 1000,
  });
  const flush = async () => {
    for (let k = 0; k < 10; k++) {
      pending.splice(0).forEach((r) => r());
      await new Promise((r) => setTimeout(r, 0));
    }
  };
  const idle = () => new Promise((r) => setTimeout(r, 0));
  return { src, calls, store, flush, idle, tick: (ms: number) => (t += ms) };
}

describe('PackSource', () => {
  it('Kernpakete sind sofort bereit, Nachladepakete erst nach dem Laden', async () => {
    const { src, flush, store } = setup();
    expect(src.state(0)).toBe('ready');
    expect(src.state(1)).toBe('unknown');
    src.request(1, 0);
    expect(src.state(1)).toBe('loading');
    await flush();
    expect(src.state(1)).toBe('ready');
    expect(store.has('a.bin')).toBe(true);
    expect([...(await src.readTile(1, 1, 2))]).toEqual([7, 7]);
  });

  it('höchstens zwei Downloads gleichzeitig, wichtigstes zuerst', async () => {
    const { src, calls, flush, idle } = setup();
    src.request(3, 5);
    src.request(2, 5);
    src.request(1, 9);
    src.request(4, 1);
    await idle();
    const names = () => calls.map((c) => c.split('/').pop());
    expect(names()).toEqual(['c.bin', 'b.bin']);
    await flush();
    expect(names()).toEqual(['c.bin', 'b.bin', 'd.bin', 'a.bin']);
  });

  it('nimmt Pakete aus dem Region-Cache ohne Netz', async () => {
    const { src, calls, flush } = setup({ store: new Map([['a.bin', bytes(4, 3)]]) });
    src.request(1, 0);
    await flush();
    expect(calls).toHaveLength(0);
    expect(src.state(1)).toBe('ready');
  });

  it('nicht ladbare Pakete sind gesperrt und werden erst nach der Pause erneut versucht', async () => {
    const { src, calls, flush, tick, idle } = setup({ fail: ['a.bin'] });
    src.request(1, 0);
    await flush();
    expect(src.isBlocked(1)).toBe(true);
    src.request(1, 0);
    expect(calls).toHaveLength(1);
    tick(1500);
    src.request(1, 0);
    await idle();
    expect(calls).toHaveLength(2);
  });
});
