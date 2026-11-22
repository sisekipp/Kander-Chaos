import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { PhysicsBody } from '@babylonjs/core/Physics/v2/physicsBody';
import { PhysicsShapeHeightField, PhysicsShapeMesh } from '@babylonjs/core/Physics/v2/physicsShape';
import { PhysicsMotionType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import type { Scene } from '@babylonjs/core/scene';
import type { Material } from '@babylonjs/core/Materials/material';
import type { WorldIndex } from '@kandern/world-format';
import type { GeometryBuffers } from './gen/GeoBuilder.ts';
import type { BuiltTile, Ring } from './protocol.ts';
import { StreamingPlanner } from './StreamingPlanner.ts';
import type { WorkerPool } from './WorkerPool.ts';
import type { WorldMaterials } from './materials.ts';

interface LoadedTile {
  id: string;
  ring: Ring;
  root: TransformNode;
  meshes: Mesh[];
  physics: { body: PhysicsBody; node: TransformNode }[];
  hasCollision: boolean;
  heightfield: { samples: number; heights: Float32Array; size: number } | null;
}

interface UploadJob {
  tileId: string;
  ring: Ring;
  run: () => void;
}

export interface TileManagerOptions {
  scene: Scene;
  index: WorldIndex;
  /** Basis-URL des world-Ordners, endet mit "/". */
  worldUrl: string;
  pool: WorkerPool;
  materials: WorldMaterials;
  treeBases: Mesh[];
  viewDistance: number;
  vegetationDensity: number;
  maxTiles?: number;
  /** Physik verfügbar? (Kollision nur für Ring 0) */
  physics: boolean;
  /** Upload-Budget pro Bild in ms. */
  uploadBudgetMs?: number;
  onTileBuilt?: (t: BuiltTile) => void;
}

/**
 * Lädt, ersetzt und entlädt Kacheln um den Spieler. Geometrie entsteht im Worker; das Einhängen in
 * die Szene läuft zeitlich gestückelt (Budget pro Bild), damit kein Bild lange hängt.
 */
export class TileManager {
  readonly planner: StreamingPlanner;
  private readonly loaded = new Map<string, LoadedTile>();
  private readonly inFlight = new Map<string, Ring>();
  private readonly desired = new Map<string, Ring>();
  private readonly queue: UploadJob[] = [];
  /** Halb fertige Kacheln (Ring-Wechsel): werden erst bei vollständigem Upload getauscht. */
  private readonly staging = new Map<string, LoadedTile>();
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

  get loadedCount(): number {
    return this.loaded.size;
  }

  get pendingCount(): number {
    return this.inFlight.size + this.queue.length;
  }

  setQuality(viewDistance: number, vegetationDensity: number): void {
    this.planner.setViewDistance(viewDistance);
    this.vegetationDensity = vegetationDensity;
  }

  /** Ist an (x, z) die Kollision der Ring-0-Kachel bereit? */
  isCollisionReady(x: number, z: number): boolean {
    if (!this.o.physics) return this.isReady(x, z);
    const s = this.o.index.tileSize;
    const t = this.loaded.get(`${Math.floor(x / s)},${Math.floor(z / s)}`);
    return !!t && t.ring === 0 && t.hasCollision;
  }

  /** Geländehöhe aus dem Höhenraster einer geladenen Ring-0-Kachel (bilinear), sonst null. */
  heightAt(x: number, z: number): number | null {
    const s = this.o.index.tileSize;
    const tx = Math.floor(x / s),
      tz = Math.floor(z / s);
    const hf = this.loaded.get(`${tx},${tz}`)?.heightfield ?? this.staging.get(`${tx},${tz}`)?.heightfield;
    if (!hf) return null;
    const n = hf.samples - 1;
    const fx = Math.min(n, Math.max(0, ((x - tx * s) / s) * n));
    const fz = Math.min(n, Math.max(0, ((z - tz * s) / s) * n));
    const i0 = Math.min(Math.floor(fx), n - 1),
      j0 = Math.min(Math.floor(fz), n - 1);
    const ax = fx - i0,
      az = fz - j0,
      w = hf.samples,
      h = hf.heights;
    const k = j0 * w + i0;
    return (h[k] * (1 - ax) + h[k + 1] * ax) * (1 - az) + (h[k + w] * (1 - ax) + h[k + w + 1] * ax) * az;
  }

  isReady(x: number, z: number): boolean {
    const s = this.o.index.tileSize;
    const t = this.loaded.get(`${Math.floor(x / s)},${Math.floor(z / s)}`);
    return !!t && t.ring === 0;
  }

  /** Pro Bild aufrufen. */
  update(x: number, z: number, vx: number, vz: number): void {
    if (this.disposed) return;
    const now = performance.now();
    if (now - this.lastPlan > 200) {
      this.lastPlan = now;
      this.replan(x, z, vx, vz);
    }
    this.processUploads();
  }

  private replan(x: number, z: number, vx: number, vz: number): void {
    const plan = this.planner.plan(x, z, vx, vz);
    this.desired.clear();
    for (const t of plan) this.desired.set(t.id, t.ring);
    // Entladen, was nicht mehr gebraucht wird
    for (const [id, t] of this.loaded) if (!this.desired.has(id)) this.unload(t, id);
    for (const [id, t] of this.staging)
      if (!this.desired.has(id)) {
        this.disposeTile(t);
        this.staging.delete(id);
      }
    // Anfragen in Prioritätsreihenfolge, begrenzt auf wenige gleichzeitige Aufträge
    const maxInFlight = this.o.pool.size * 2;
    for (const t of plan) {
      if (this.inFlight.size >= maxInFlight) break;
      const cur = this.loaded.get(t.id);
      if (cur && cur.ring === t.ring) continue;
      if (this.inFlight.get(t.id) === t.ring) continue;
      if (this.inFlight.has(t.id)) continue;
      if (this.queue.some((j) => j.tileId === t.id && j.ring === t.ring)) continue;
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
        const totalMs = performance.now() - t0;
        if (ring === 0) this.maxTileBuildMs = Math.max(this.maxTileBuildMs, totalMs);
        this.o.onTileBuilt?.(built);
        this.enqueue(built);
      })
      .catch((e) => {
        this.inFlight.delete(id);
        console.warn('[tiles]', e);
      });
  }

  private enqueue(b: BuiltTile): void {
    const { scene, materials } = this.o;
    const root = new TransformNode(`tile-${b.tileId}-r${b.ring}`, scene);
    root.position.set(b.tx * b.size, 0, b.tz * b.size);
    root.computeWorldMatrix(true); // vor dem Einfrieren der Kinder, sonst landen alle Kacheln am Ursprung
    root.freezeWorldMatrix();
    root.setEnabled(false);
    const tile: LoadedTile = {
      id: b.tileId,
      ring: b.ring,
      root,
      meshes: [],
      physics: [],
      hasCollision: false,
      heightfield: b.heightfield ? { ...b.heightfield, heights: b.heightfield.heights.slice(), size: b.size } : null,
    };
    const old = this.staging.get(b.tileId);
    if (old) this.disposeTile(old);
    this.staging.set(b.tileId, tile);
    const job = (run: () => void) =>
      this.queue.push({
        tileId: b.tileId,
        ring: b.ring,
        run: () => {
          if (this.staging.get(b.tileId) === tile) run();
        },
      });

    job(() => tile.meshes.push(this.makeMesh(`terrain-${b.tileId}`, b.terrain, materials.terrain, root)));
    if (b.buildings) {
      const bm = b.buildings;
      job(() =>
        tile.meshes.push(
          this.makeMesh(
            `buildings-${b.tileId}`,
            bm,
            b.ring === 0 ? materials.buildings : materials.buildingsSimple,
            root,
          ),
        ),
      );
    }
    if (b.roads) {
      const rm = b.roads;
      job(() => tile.meshes.push(this.makeMesh(`roads-${b.tileId}`, rm, materials.roads, root)));
    }
    job(() => {
      b.trees.matrices.forEach((m, sp) => {
        if (b.trees.counts[sp] === 0) return;
        const base = this.o.treeBases[sp];
        // Eigene Geometrie-Kopie je Kachel: Thin-Instance-Puffer hängen an der Geometrie – bei geteilter
        // Geometrie überschreiben sich die Kacheln gegenseitig. Weltkoordinaten eingebacken, kein Elternknoten.
        const inst = new Mesh(`trees${sp}-${b.tileId}`, scene);
        this.treeData(sp).applyToMesh(inst);
        inst.material = base.material;
        const ox = b.tx * b.size,
          oz = b.tz * b.size;
        for (let k = 0; k < m.length; k += 16) {
          m[k + 12] += ox;
          m[k + 14] += oz;
        }
        inst.thinInstanceSetBuffer('matrix', m, 16, true);
        inst.thinInstanceRefreshBoundingInfo(false);
        inst.isPickable = false;
        inst.setEnabled(false); // wird mit der Kachel aktiviert
        tile.meshes.push(inst);
      });
    });
    if (b.ring === 0 && this.o.physics && b.heightfield) {
      const hf = b.heightfield;
      job(() => this.addTerrainCollision(tile, b, hf));
      const buildingMesh = () => tile.meshes.find((m) => m.name.startsWith('buildings-'));
      job(() => {
        const bm = buildingMesh();
        if (bm) {
          const node = new TransformNode(`bcol-${b.tileId}`, scene);
          node.position.copyFrom(root.position);
          const body = new PhysicsBody(node, PhysicsMotionType.STATIC, false, scene);
          body.shape = new PhysicsShapeMesh(bm, scene);
          tile.physics.push({ body, node });
        }
        tile.hasCollision = true;
      });
    }
    // Letzter Schritt: alte Kachel gegen neue tauschen (ohne Lücke)
    job(() => {
      const prev = this.loaded.get(b.tileId);
      root.setEnabled(true);
      for (const m of tile.meshes) {
        m.setEnabled(true);
        m.computeWorldMatrix(true);
        m.freezeWorldMatrix();
      }
      if (prev) this.disposeTile(prev);
      this.loaded.set(b.tileId, tile);
      this.staging.delete(b.tileId);
    });
  }

  /**
   * Havok-Heightfield: Layout wie Babylons Ground-Mesh-Konvertierung (Zeilen = z gespiegelt,
   * Spalten = x, Höhen relativ zum Minimum; Körper in der Kachelmitte auf Höhe des Minimums).
   */
  private addTerrainCollision(tile: LoadedTile, b: BuiltTile, hf: { samples: number; heights: Float32Array }): void {
    const n = hf.samples;
    let min = Infinity;
    for (let i = 0; i < hf.heights.length; i++) min = Math.min(min, hf.heights[i]);
    const data = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) data[(n - 1 - j) * n + i] = hf.heights[j * n + i] - min;
    const node = new TransformNode(`tcol-${b.tileId}`, this.o.scene);
    node.position.set(b.tx * b.size + b.size / 2, min, b.tz * b.size + b.size / 2);
    const body = new PhysicsBody(node, PhysicsMotionType.STATIC, false, this.o.scene);
    body.shape = new PhysicsShapeHeightField(b.size, b.size, n, n, data, this.o.scene);
    tile.physics.push({ body, node });
  }

  private readonly treeVertexData: VertexData[] = [];
  private treeData(sp: number): VertexData {
    return (this.treeVertexData[sp] ??= VertexData.ExtractFromMesh(this.o.treeBases[sp], true, true));
  }

  private makeMesh(name: string, g: GeometryBuffers, material: Material, parent: TransformNode): Mesh {
    const mesh = new Mesh(name, this.o.scene, parent);
    const vd = new VertexData();
    vd.positions = g.positions;
    vd.normals = g.normals;
    vd.colors = g.colors;
    vd.indices = g.indices;
    if (g.uvs) vd.uvs = g.uvs;
    if (g.uvs2) vd.uvs2 = g.uvs2;
    vd.applyToMesh(mesh, false);
    mesh.material = material;
    mesh.isPickable = false;
    mesh.doNotSyncBoundingInfo = true;
    return mesh;
  }

  /** Arbeitet die Upload-Warteschlange innerhalb des Zeitbudgets ab (mind. ein Schritt pro Bild). */
  private processUploads(): void {
    const budget = this.o.uploadBudgetMs ?? 4;
    const t0 = performance.now();
    let n = 0;
    while (this.queue.length && (n === 0 || performance.now() - t0 < budget)) {
      // Ring-0-Aufträge zuerst
      let k = this.queue.findIndex((j) => j.ring === 0);
      if (k < 0) k = 0;
      const [job] = this.queue.splice(k, 1);
      job.run();
      n++;
    }
  }

  private unload(t: LoadedTile, id: string): void {
    this.disposeTile(t);
    this.loaded.delete(id);
    // Ausstehende Upload-Schritte dieser Kachel verwerfen
    for (let i = this.queue.length - 1; i >= 0; i--)
      if (this.queue[i].tileId === id && !this.staging.has(id)) this.queue.splice(i, 1);
  }

  private disposeTile(t: LoadedTile): void {
    for (const p of t.physics) {
      p.body.shape?.dispose();
      p.body.dispose();
      p.node.dispose();
    }
    t.physics.length = 0;
    for (const m of t.meshes) m.dispose(false, false);
    t.meshes.length = 0;
    t.root.dispose();
  }

  dispose(): void {
    this.disposed = true;
    for (const t of this.loaded.values()) this.disposeTile(t);
    for (const t of this.staging.values()) this.disposeTile(t);
    this.loaded.clear();
    this.staging.clear();
    this.queue.length = 0;
  }
}
