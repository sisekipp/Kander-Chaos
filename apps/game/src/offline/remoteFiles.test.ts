import { describe, expect, it } from 'vite-plus/test';
import { RemoteFiles } from './remoteFiles.ts';

function setup(fail: string[] = [], cached = new Map<string, ArrayBuffer>()) {
  const calls: string[] = [];
  const events: [string, boolean][] = [];
  let t = 0;
  const rf = new RemoteFiles('https://x.test/m/', {
    fetch: async (url) => {
      calls.push(url);
      const bad = fail.some((f) => url.endsWith(f));
      return { ok: !bad, status: bad ? 404 : 200, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
    },
    store: { get: async (f) => cached.get(f) ?? null, put: async (f, d) => void cached.set(f, d) },
    sha256: async () => 'ok',
    now: () => t,
    retryMs: 1000,
  });
  rf.onLoaded = (f, d) => events.push([f, d !== null]);
  const idle = async () => {
    for (let k = 0; k < 6; k++) await new Promise((r) => setTimeout(r, 0));
  };
  return { rf, calls, events, cached, idle, tick: (ms: number) => (t += ms) };
}

describe('RemoteFiles', () => {
  it('lädt, prüft, legt im Cache ab und meldet fertig', async () => {
    const { rf, events, cached, idle } = setup();
    rf.request({ file: 'a.glb', sha256: 'ok', bytes: 3 }, 0);
    await idle();
    expect(rf.state('a.glb')).toBe('ready');
    expect(cached.has('a.glb')).toBe(true);
    expect(events).toEqual([['a.glb', true]]);
    expect(rf.take('a.glb')?.byteLength).toBe(3);
    expect(rf.take('a.glb')).toBeNull();
  });

  it('falsche Prüfsumme oder Netzfehler sperren die Datei, neuer Versuch erst nach der Pause', async () => {
    const { rf, calls, events, idle, tick } = setup(['b.glb']);
    rf.request({ file: 'b.glb', sha256: 'ok' }, 0);
    await idle();
    expect(rf.state('b.glb')).toBe('blocked');
    expect(events).toEqual([['b.glb', false]]);
    rf.request({ file: 'b.glb', sha256: 'ok' }, 0);
    await idle();
    expect(calls).toHaveLength(1);
    tick(1500);
    rf.request({ file: 'b.glb', sha256: 'ok' }, 0);
    await idle();
    expect(calls).toHaveLength(2);
    rf.request({ file: 'c.glb', sha256: 'falsch' }, 0);
    await idle();
    expect(rf.state('c.glb')).toBe('blocked');
  });

  it('aus dem Region-Cache ohne Netz', async () => {
    const { rf, calls, idle } = setup([], new Map([['d.glb', new ArrayBuffer(4)]]));
    rf.request({ file: 'd.glb', sha256: 'ok' }, 0);
    await idle();
    expect(calls).toHaveLength(0);
    expect(rf.state('d.glb')).toBe('ready');
  });
});
