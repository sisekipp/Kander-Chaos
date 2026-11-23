/**
 * Nachladen einzelner Dateien bei Bedarf (Spec regional-streaming „Modelle der Region nachladen“): erst aus dem
 * Region-Cache, sonst aus dem Netz mit Prüfsumme, höchstens zwei Downloads gleichzeitig, wichtigste zuerst.
 * Nicht ladbare Dateien gelten als gesperrt und werden nach einer Pause erneut versucht. Reine Logik; Netz,
 * Cache, Hash und Uhr sind injiziert (Tests).
 */
import type { PackSourceDeps, PackStore } from './packSource.ts';

export interface RemoteFile {
  file: string;
  sha256: string;
  bytes?: number;
}

export type RemoteState = 'ready' | 'loading' | 'blocked' | 'unknown';

export class RemoteFiles {
  private readonly states = new Map<string, RemoteState>();
  private readonly blockedAt = new Map<string, number>();
  private readonly waiting = new Map<string, { f: RemoteFile; prio: number }>();
  private readonly done = new Map<string, ArrayBuffer>();
  private running = 0;
  /** Datei fertig geladen (Bytes) oder gesperrt (null). */
  onLoaded: ((file: string, data: ArrayBuffer | null) => void) | null = null;

  constructor(
    private readonly base: string,
    private readonly d: Omit<PackSourceDeps, 'store'> & { store: PackStore | null },
  ) {}

  private get now(): number {
    return (this.d.now ?? Date.now)();
  }

  state(file: string): RemoteState {
    return this.states.get(file) ?? 'unknown';
  }

  /** Datei anfordern; kleinere Priorität = wichtiger. */
  request(f: RemoteFile, prio: number): void {
    const s = this.state(f.file);
    if (s === 'ready' || s === 'loading') return;
    if (s === 'blocked' && this.now - (this.blockedAt.get(f.file) ?? 0) < (this.d.retryMs ?? 30000)) return;
    const prev = this.waiting.get(f.file);
    this.waiting.set(f.file, { f, prio: prev ? Math.min(prev.prio, prio) : prio });
    this.pump();
  }

  /** Bytes einer fertigen Datei einmalig abholen (danach frei für den Speicher). */
  take(file: string): ArrayBuffer | null {
    const b = this.done.get(file) ?? null;
    this.done.delete(file);
    return b;
  }

  private pump(): void {
    while (this.running < (this.d.maxParallel ?? 2) && this.waiting.size) {
      let best: { f: RemoteFile; prio: number } | null = null;
      for (const w of this.waiting.values()) if (!best || w.prio < best.prio) best = w;
      this.waiting.delete(best!.f.file);
      this.states.set(best!.f.file, 'loading');
      this.running++;
      void this.load(best!.f).finally(() => {
        this.running--;
        this.pump();
      });
    }
  }

  private async load(f: RemoteFile): Promise<void> {
    try {
      let buf = await this.d.store?.get(f.file);
      if (!buf) {
        const res = await this.d.fetch(new URL(f.file, this.base).href);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        buf = await res.arrayBuffer();
        if (
          (f.bytes !== undefined && buf.byteLength !== f.bytes) ||
          (await this.d.sha256(new Uint8Array(buf))) !== f.sha256
        )
          throw new Error('Prüfsumme falsch');
        await this.d.store?.put(f.file, buf);
      }
      this.states.set(f.file, 'ready');
      this.done.set(f.file, buf);
      this.onLoaded?.(f.file, buf);
    } catch (e) {
      console.warn('[remote]', f.file, e);
      this.states.set(f.file, 'blocked');
      this.blockedAt.set(f.file, this.now);
      this.onLoaded?.(f.file, null);
    }
  }
}
