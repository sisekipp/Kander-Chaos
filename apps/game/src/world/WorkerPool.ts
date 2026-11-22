import type { BuildRequest, BuiltTile, WorkerResponse } from './protocol.ts';

interface Pending {
  resolve: (t: BuiltTile) => void;
  reject: (e: Error) => void;
}

/** Kleiner Pool aus 1–2 Workern (A9X: 2 Kerne – einer bleibt für Rendering/Physik). */
export class WorkerPool {
  private readonly workers: Worker[] = [];
  private readonly busy: number[] = [];
  private readonly pending = new Map<number, Pending>();
  private reqId = 0;

  constructor(size = Math.max(1, Math.min(2, (navigator.hardwareConcurrency ?? 2) - 1))) {
    for (let i = 0; i < size; i++) {
      const w = new Worker(new URL('./worker/tileWorker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (ev: MessageEvent<WorkerResponse>) => this.onMessage(i, ev.data);
      this.workers.push(w);
      this.busy.push(0);
    }
  }

  get size(): number {
    return this.workers.length;
  }

  get inFlight(): number {
    return this.pending.size;
  }

  build(req: Omit<BuildRequest, 'type' | 'reqId'>): Promise<BuiltTile> {
    const reqId = ++this.reqId;
    // Worker mit den wenigsten offenen Aufträgen
    let wi = 0;
    for (let i = 1; i < this.workers.length; i++) if (this.busy[i] < this.busy[wi]) wi = i;
    this.busy[wi]++;
    return new Promise((resolve, reject) => {
      this.pending.set(reqId, { resolve, reject });
      this.workers[wi].postMessage({ ...req, type: 'build', reqId } satisfies BuildRequest);
    });
  }

  private onMessage(wi: number, msg: WorkerResponse): void {
    this.busy[wi] = Math.max(0, this.busy[wi] - 1);
    const p = this.pending.get(msg.reqId);
    if (!p) return;
    this.pending.delete(msg.reqId);
    if (msg.type === 'built') p.resolve(msg);
    else p.reject(new Error(`${msg.tileId}: ${msg.message}`));
  }

  dispose(): void {
    for (const w of this.workers) w.terminate();
    for (const p of this.pending.values()) p.reject(new Error('Pool beendet'));
    this.pending.clear();
  }
}
