import type { Scene } from '@babylonjs/core/scene';
import type { WorldIndex } from '@kandern/world-format';
import type { BuiltTile, Ring } from '../protocol.ts';
import type { WorkerPool } from '../WorkerPool.ts';
import { StreamingPlanner } from './StreamingPlanner.ts';
import { UploadQueue } from './UploadQueue.ts';
import { LayerRegistry, type TileLayer } from './layers.ts';
import { TileState } from './TileState.ts';

export interface TileManagerOptions {
  scene: Scene;
  index: WorldIndex;
  /** Basis-URL des world-Ordners, endet mit "/". */
  worldUrl: string;
  pool: WorkerPool;
  viewDistance: number;
  vegetationDensity: number;
  maxTiles?: number;
  /** Physik verfügbar? Ohne Physik gilt eine Ring-0-Kachel sofort als begehbar. */
  physics: boolean;
  /** Upload-Budget pro Bild in ms. */
  uploadBudgetMs?: number;
  onTileBuilt?: (t: BuiltTile) => void;
}

/**
 * Lebenszyklus der Kacheln: planen, beim Worker anfragen, über Layer hochladen, tauschen, entladen.
 * Was eine Kachel enthält, bestimmen die registrierten Layer (Geometrie, Kollision, Bäume, …).
 */
export class TileManager {
  readonly planner: StreamingPlanner;
  private readonly layers: TileLayer[] = [];
  private readonly registry = new LayerRegistry();
  private readonly loaded = new Map<string, TileState>();
  private readonly staging = new Map<string, TileState>();
  private readonly inFlight = new Map<string, Ring>();
  private readonly desired = new Map<string, Ring>();
  private readonly queue = new UploadQueue();
  private lastPlan = -Infinity;
  private vegetationDensity: number;
  private disposed = false;
  maxTileBuildMs = 0;

  constructor(private readonly o: TileManagerOptions) {
    const tiles = o.index.tiles;
    this.planner = new StreamingPlanner(
      { tileSize: o.index.tileSize, viewDistance: o.viewDistance, maxTiles: o.maxTiles ?? 90 },
      (tx, tz) => `${tx},${tz}` in tiles,
    );
    this.vegetationDensity = o.vegetationDensity;
  }

  /** Registriert eine Ebene. Reihenfolge = Upload-Reihenfolge innerhalb einer Kachel. */
  addLayer(layer: TileLayer): void {
    this.registry.add(layer);
    this.layers.push(layer);
  }

  get loadedCount(): number {
    return this.loaded.size;
  }

  get pendingCount(): number {
    return this.inFlight.size + this.queue.length;
  }

  /** Sind alle geplanten Kacheln in der geplanten Detailstufe geladen und nichts mehr unterwegs? */
  get isSettled(): boolean {
    if (this.pendingCount > 0 || this.desired.size === 0) return false;
    for (const [id, ring] of this.desired) if (this.loaded.get(id)?.ring !== ring) return false;
    return true;
  }

  /** Alle sichtbaren Kacheln (für Layer, die über Kacheln hinweg arbeiten). */
  get tiles(): IterableIterator<TileState> {
    return this.loaded.values();
  }

  tileAt(x: number, z: number): TileState | undefined {
    const s = this.o.index.tileSize;
    return this.loaded.get(`${Math.floor(x / s)},${Math.floor(z / s)}`);
  }

  setQuality(viewDistance: number, vegetationDensity: number): void {
    this.planner.setViewDistance(viewDistance);
    this.vegetationDensity = vegetationDensity;
  }

  /** Geländehöhe aus dem Höhenraster einer Ring-0-Kachel (auch während des Uploads), sonst null. */
  heightAt(x: number, z: number): number | null {
    const s = this.o.index.tileSize;
    const id = `${Math.floor(x / s)},${Math.floor(z / s)}`;
    return (this.loaded.get(id) ?? this.staging.get(id))?.heightAt(x, z) ?? null;
  }

  isReady(x: number, z: number): boolean {
    return this.tileAt(x, z)?.ring === 0;
  }

  /** Ist an (x, z) die Kollision der Ring-0-Kachel bereit? */
  isCollisionReady(x: number, z: number): boolean {
    const t = this.tileAt(x, z);
    if (!this.o.physics) return t?.ring === 0;
    return !!t && t.ring === 0 && t.hasCollision;
  }

  /** Pro Bild aufrufen. */
  update(x: number, z: number, vx: number, vz: number): void {
    if (this.disposed) return;
    const now = performance.now();
    if (now - this.lastPlan > 200) {
      this.lastPlan = now;
      this.replan(x, z, vx, vz);
    }
    this.queue.process(this.o.uploadBudgetMs ?? 4);
  }

  private replan(x: number, z: number, vx: number, vz: number): void {
    const plan = this.planner.plan(x, z, vx, vz);
    this.desired.clear();
    for (const t of plan) this.desired.set(t.id, t.ring);
    for (const [id, t] of this.loaded) {
      if (this.desired.has(id)) continue;
      this.release(t);
      this.loaded.delete(id);
    }
    for (const [id, t] of this.staging) {
      if (this.desired.has(id)) continue;
      t.dispose();
      this.staging.delete(id);
      this.queue.drop(id);
    }
    const maxInFlight = this.o.pool.size * 2;
    for (const t of plan) {
      if (this.inFlight.size >= maxInFlight) break;
      if (this.loaded.get(t.id)?.ring === t.ring) continue;
      if (this.inFlight.has(t.id) || this.queue.has(t.id, t.ring)) continue;
      this.request(t.id, t.ring);
    }
  }

  private request(id: string, ring: Ring): void {
    const loc = this.o.index.tiles[id];
    if (!loc) return;
    const pack = this.o.index.packs[loc[0]];
    this.inFlight.set(id, ring);
    const t0 = performance.now();
    this.o.pool
      .build({
        tileId: id,
        packUrl: new URL(pack.file, this.o.worldUrl).href,
        offset: loc[1],
        length: loc[2],
        ring,
        vegetationDensity: this.vegetationDensity,
      })
      .then((built) => {
        this.inFlight.delete(id);
        if (this.disposed || this.desired.get(id) !== ring) return; // inzwischen überholt
        if (ring === 0) this.maxTileBuildMs = Math.max(this.maxTileBuildMs, performance.now() - t0);
        this.o.onTileBuilt?.(built);
        this.stage(built);
      })
      .catch((e) => {
        this.inFlight.delete(id);
        console.warn('[tiles]', e);
      });
  }

  /** Legt eine Kachel an und reiht die Upload-Schritte aller Layer ein; der letzte Schritt tauscht sie ein. */
  private stage(b: BuiltTile): void {
    const tile = new TileState(this.o.scene, b);
    const prevStaging = this.staging.get(b.tileId);
    if (prevStaging) {
      this.queue.drop(b.tileId);
      prevStaging.dispose();
    }
    this.staging.set(b.tileId, tile);
    const guard = (run: () => void) => () => {
      if (this.staging.get(b.tileId) === tile) run();
    };
    for (const layer of this.layers)
      for (const step of layer.upload(tile, b)) this.queue.push({ tileId: b.tileId, ring: b.ring, run: guard(step) });
    this.queue.push({
      tileId: b.tileId,
      ring: b.ring,
      run: guard(() => {
        const prev = this.loaded.get(b.tileId);
        tile.show();
        if (prev) this.release(prev);
        this.loaded.set(b.tileId, tile);
        this.staging.delete(b.tileId);
        this.registry.ready(tile);
      }),
    });
  }

  private release(t: TileState): void {
    this.registry.unload(t);
    t.dispose();
  }

  dispose(): void {
    this.disposed = true;
    for (const t of this.loaded.values()) this.release(t);
    for (const t of this.staging.values()) t.dispose();
    this.loaded.clear();
    this.staging.clear();
    this.queue.clear();
  }
}
