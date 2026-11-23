/**
 * Woher die Kachelpakete kommen (Spec regional-streaming): Kernpakete liegen im App-Bundle bzw. im Welt-Cache
 * (`kc-world`, der Worker liest sie per Range-Anfrage), Nachladeregionen kommen aus dem Region-Cache oder werden
 * von Cloudflare geladen. Höchstens zwei Downloads gleichzeitig, wichtigste zuerst; nicht ladbare Pakete gelten
 * als gesperrt und werden nach einer Pause erneut versucht. Netz, Cache, Hash und Uhr sind injiziert (Tests).
 */
import type { WorldIndex } from '@kandern/world-format';

export type PackState = 'ready' | 'loading' | 'blocked' | 'unknown';

export interface PackStore {
  get(file: string): Promise<ArrayBuffer | null>;
  put(file: string, data: ArrayBuffer): Promise<void>;
}

export interface PackSourceDeps {
  fetch: (url: string) => Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }>;
  store: PackStore | null;
  sha256: (bytes: Uint8Array) => Promise<string>;
  now?: () => number;
  maxParallel?: number;
  /** Pause bis zum nächsten Versuch für ein gesperrtes Paket (ms). */
  retryMs?: number;
  /** Wie viele Nachladepakete im Arbeitsspeicher bleiben. */
  memoryPacks?: number;
}

export class PackSource {
  private readonly states = new Map<number, PackState>();
  private readonly blockedAt = new Map<number, number>();
  private readonly memory = new Map<number, ArrayBuffer>();
  private readonly waiting = new Map<number, number>();
  private running = 0;
  /** Wird gerufen, wenn ein Paket bereit oder gesperrt wurde (TileManager plant dann neu). */
  onChange: (() => void) | null = null;

  constructor(
    private readonly index: WorldIndex,
    private readonly remoteBase: string,
    private readonly d: PackSourceDeps,
  ) {}

  private get now(): number {
    return (this.d.now ?? Date.now)();
  }

  isRemote(pack: number): boolean {
    return !!this.index.packs[pack]?.remote;
  }

  state(pack: number): PackState {
    if (!this.isRemote(pack)) return 'ready';
    return this.states.get(pack) ?? 'unknown';
  }

  isBlocked(pack: number): boolean {
    return this.state(pack) === 'blocked';
  }

  /** Paket anfordern; kleinere Priorität = wichtiger. Mehrfachaufrufe übernehmen die beste Priorität. */
  request(pack: number, priority: number): void {
    const s = this.state(pack);
    if (s === 'ready' || s === 'loading') return;
    if (s === 'blocked' && this.now - (this.blockedAt.get(pack) ?? 0) < (this.d.retryMs ?? 30000)) return;
    const prev = this.waiting.get(pack);
    this.waiting.set(pack, prev === undefined ? priority : Math.min(prev, priority));
    this.pump();
  }

  /** Bytes einer Kachel aus einem bereiten Nachladepaket (Kopie, darf an den Worker übertragen werden). */
  async readTile(pack: number, offset: number, length: number): Promise<Uint8Array> {
    let buf = this.memory.get(pack);
    if (!buf) {
      buf = (await this.d.store?.get(this.index.packs[pack].file)) ?? undefined;
      if (!buf) {
        this.states.delete(pack);
        throw new Error(`Paket ${this.index.packs[pack].file} nicht mehr im Speicher`);
      }
      this.remember(pack, buf);
    }
    return new Uint8Array(buf.slice(offset, offset + length));
  }

  private remember(pack: number, buf: ArrayBuffer): void {
    this.memory.delete(pack);
    this.memory.set(pack, buf);
    while (this.memory.size > (this.d.memoryPacks ?? 6)) this.memory.delete(this.memory.keys().next().value!);
  }

  private pump(): void {
    while (this.running < (this.d.maxParallel ?? 2) && this.waiting.size) {
      let best = -1,
        bp = Infinity;
      for (const [p, prio] of this.waiting) if (prio < bp) [best, bp] = [p, prio];
      this.waiting.delete(best);
      this.states.set(best, 'loading');
      this.running++;
      void this.load(best).finally(() => {
        this.running--;
        this.onChange?.();
        this.pump();
      });
    }
  }

  private async load(pack: number): Promise<void> {
    const entry = this.index.packs[pack];
    try {
      const cached = await this.d.store?.get(entry.file);
      if (cached) {
        this.remember(pack, cached);
        this.states.set(pack, 'ready');
        return;
      }
      const res = await this.d.fetch(new URL(entry.file, this.remoteBase).href);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      if (buf.byteLength !== entry.bytes || (await this.d.sha256(new Uint8Array(buf))) !== entry.sha256)
        throw new Error('Prüfsumme falsch');
      await this.d.store?.put(entry.file, buf);
      this.remember(pack, buf);
      this.states.set(pack, 'ready');
      this.blockedAt.delete(pack);
    } catch (e) {
      console.warn('[regions]', entry.file, e);
      this.states.set(pack, 'blocked');
      this.blockedAt.set(pack, this.now);
    }
  }
}
