import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { FxaaPostProcess } from '@babylonjs/core/PostProcesses/fxaaPostProcess';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import type { WorldIndex } from '@kandern/world-format';
import type { Game } from '../engine/Game.ts';
import { enableHavok, releaseHavok } from '../engine/physics/havok.ts';
import { BASE_URL } from '../engine/assets.ts';
import type { QualitySettings } from '../engine/quality.ts';
import { Player } from '../player/Player.ts';
import { RouteFollower } from '../player/route.ts';
import { FAST_SPEED } from '../player/Player.ts';
import { createWorldMaterials, type WorldMaterials } from './materials.ts';
import { createTreeBases } from './treeMeshes.ts';
import { TileManager } from './TileManager.ts';
import { WorkerPool } from './WorkerPool.ts';
import { createPanorama } from './panorama.ts';

export interface Place {
  name: string;
  kind: string;
  x: number;
  z: number;
}

export const WORLD_URL = new URL(`${BASE_URL}world/`, location.href).href;

export async function loadWorldIndex(): Promise<{ index: WorldIndex; places: Place[] }> {
  const [index, places] = await Promise.all([
    fetch(`${WORLD_URL}index.json`).then((r) => {
      if (!r.ok) throw new Error(`Weltindex fehlt (HTTP ${r.status}) – Pipeline "build" ausführen`);
      return r.json() as Promise<WorldIndex>;
    }),
    fetch(`${WORLD_URL}places.json`).then((r) => (r.ok ? (r.json() as Promise<Place[]>) : [])),
  ]);
  return { index, places };
}

/** Verbindet Streaming, Spielfigur, Physik und Qualitätsstufen zur spielbaren Welt. */
export class World {
  readonly tiles: TileManager;
  readonly player: Player;
  private readonly pool: WorkerPool;
  private readonly materials: WorldMaterials;
  private readonly panorama: ReturnType<typeof createPanorama>;
  private readonly unsubs: (() => void)[] = [];
  private fxaa: FxaaPostProcess | null = null;
  private shadows: ShadowGenerator | null = null;

  static async create(
    game: Game,
    opts: {
      physics?: boolean;
      start?: { x: number; z: number };
      save?: { x: number; z: number; worldVersion: string };
    } = {},
  ): Promise<World> {
    const { index, places } = await loadWorldIndex();
    let physics = opts.physics ?? true;
    if (physics) {
      try {
        const { wasmStartMs } = await enableHavok(game.scene);
        game.perf.recorder.extra.havokWasmStartMs = Math.round(wasmStartMs);
      } catch (e) {
        console.warn('Havok nicht verfügbar, Fallback ohne Physik', e);
        physics = false;
      }
    }
    // Spielstand-Position nur bei gleichem Datenstand übernehmen (neue Gebäude könnten im Weg stehen)
    const fromSave =
      opts.save && opts.save.worldVersion === index.buildVersion ? { x: opts.save.x, z: opts.save.z } : undefined;
    return new World(game, index, places, physics, opts.start ?? fromSave ?? index.spawn);
  }

  private constructor(
    private readonly game: Game,
    readonly index: WorldIndex,
    readonly places: Place[],
    readonly physics: boolean,
    start: { x: number; z: number },
  ) {
    const scene = game.scene;
    this.materials = createWorldMaterials(scene);
    const treeBases = createTreeBases(scene, this.materials.trees);
    this.pool = new WorkerPool();
    const q = game.quality;
    this.tiles = new TileManager({
      scene,
      index,
      worldUrl: WORLD_URL,
      pool: this.pool,
      materials: this.materials,
      treeBases,
      viewDistance: q.viewDistance,
      vegetationDensity: q.vegetationDensity,
      physics,
      onTileBuilt: (t) => {
        if (t.ring === 0) {
          const rec = game.perf.recorder.extra;
          rec.maxTileGenMs = Math.max(Number(rec.maxTileGenMs ?? 0), Math.round(t.stats.genMs));
          rec.maxTileBuildings = Math.max(Number(rec.maxTileBuildings ?? 0), t.stats.buildings);
        }
      },
    });
    game.camera.detachControl();
    game.camera.maxZ = 2600;
    this.panorama = createPanorama(scene, scene.fogColor);
    this.player = new Player(scene, game.camera, this.tiles, new Vector3(start.x, 0, start.z), physics);
    // Höhe beim Start: so hoch, bis die erste Kachel da ist
    this.unsubs.push(game.onFrame((dt) => this.update(dt)));
    this.unsubs.push(game.onQualityChange((qq) => this.applyQuality(qq)));
  }

  private update(dt: number): void {
    const p = this.player.position;
    const v = this.player.velocity;
    this.tiles.update(p.x, p.z, v.x, v.z);
    this.player.update(dt);
    this.panorama.follow(p.x, p.z, p.y - 60);
    this.materials.updateLighting(
      this.game.sun.direction,
      this.game.scene.fogStart,
      this.game.scene.fogEnd,
      this.game.scene.fogColor,
    );
    this.game.perf.loadedTiles = this.tiles.loadedCount;
    this.game.perf.recorder.extra.maxTileBuildMs = Math.round(this.tiles.maxTileBuildMs);
  }

  private applyQuality(q: QualitySettings): void {
    this.tiles?.setQuality(q.viewDistance, q.vegetationDensity);
    const cam = this.game.camera;
    this.game.camera.maxZ = 2600;
    if (q.fxaa && !this.fxaa) this.fxaa = new FxaaPostProcess('fxaa', 1.0, cam);
    if (!q.fxaa && this.fxaa) {
      this.fxaa.dispose(cam);
      this.fxaa = null;
    }
    if (q.shadows && !this.shadows) {
      this.shadows = new ShadowGenerator(1024, this.game.sun);
      this.shadows.usePercentageCloserFiltering = true;
      for (const m of this.player?.root.getChildMeshes() ?? [])
        if (!m.name.includes('shadow')) this.shadows.addShadowCaster(m);
    }
    if (!q.shadows && this.shadows) {
      this.shadows.dispose();
      this.shadows = null;
    }
  }

  /** Startet eine reproduzierbare Messfahrt über Ortsnamen (kinematisch, 80 km/h). */
  startRoute(names: string[], speed = FAST_SPEED): boolean {
    const pts = names
      .map((n) => this.places.find((p) => p.name === n))
      .filter((p): p is Place => !!p)
      .map((p) => [p.x, p.z] as [number, number]);
    if (pts.length < 2) return false;
    this.player.teleport(pts[0][0], pts[0][1]);
    this.player.route = new RouteFollower(pts, speed);
    return true;
  }

  get routeActive(): boolean {
    return this.player.route !== null;
  }

  dispose(): void {
    for (const u of this.unsubs) u();
    this.player.dispose();
    this.tiles.dispose();
    this.pool.dispose();
    this.panorama.dispose();
    this.materials.dispose();
    this.fxaa?.dispose(this.game.camera);
    this.shadows?.dispose();
    if (this.physics) releaseHavok(this.game.scene);
  }
}
