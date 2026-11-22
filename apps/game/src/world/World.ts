import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { FxaaPostProcess } from '@babylonjs/core/PostProcesses/fxaaPostProcess';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import type { WorldIndex } from '@kandern/world-format';
import type { Game } from '../engine/Game.ts';
import { enableHavok, releaseHavok } from '../engine/physics/havok.ts';
import { enableFixedPhysicsSteps } from '../engine/physics/fixedStep.ts';
import { PhysicsBudget } from '../engine/physics/budget/index.ts';
import { DEBUG_COLORS, DebugLines } from '../engine/debug/DebugLines.ts';
import { useGameStore } from '../state/store.ts';
import { VehicleManager } from '../vehicles/VehicleManager.ts';
import { Particles } from '../engine/fx/particles.ts';
import { PropSystem } from '../props/PropSystem.ts';
import { collectPropActors } from './propActors.ts';
import { BASE_URL } from '../engine/assets.ts';
import type { QualitySettings } from '../engine/quality.ts';
import { PlayerController } from '../player/PlayerController.ts';
import { RouteFollower } from '../player/route.ts';
import { FAST_SPEED } from '../player/constants.ts';
import { createWorldMaterials, type WorldMaterials } from './materials.ts';
import { createTreeBases } from './vegetation/treeMeshes.ts';
import { TreeLayer } from './vegetation/TreeLayer.ts';
import { TileManager } from './tiles/TileManager.ts';
import { GeometryLayer } from './tiles/GeometryLayer.ts';
import { CollisionLayer } from './tiles/CollisionLayer.ts';
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
  readonly player: PlayerController;
  private readonly pool: WorkerPool;
  private readonly materials: WorldMaterials;
  private readonly panorama: ReturnType<typeof createPanorama>;
  private readonly unsubs: (() => void)[] = [];
  readonly budget = new PhysicsBudget();
  readonly debug: DebugLines;
  readonly vehicles: VehicleManager | null;
  readonly fx: Particles;
  readonly props: PropSystem | null;
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
    this.debug = new DebugLines(scene);
    if (physics) this.unsubs.push(enableFixedPhysicsSteps(scene));
    this.unsubs.push(useGameStore.subscribe((st) => (this.debug.enabled = st.debugPhysics)));
    this.debug.enabled = useGameStore.getState().debugPhysics;
    this.tiles.addLayer(new GeometryLayer(scene, this.materials));
    if (physics) this.tiles.addLayer(new CollisionLayer(scene));
    this.tiles.addLayer(new TreeLayer(scene, treeBases));
    // Fahrzeuge brauchen Physik (Kollision, Raycasts)
    this.fx = new Particles(scene);
    this.vehicles = physics ? new VehicleManager(scene, this.tiles, this.debug, this.budget, this.fx) : null;
    if (this.vehicles) this.tiles.addLayer(this.vehicles.layer);
    // Kleinobjekte brauchen Physik (Ersatzkörper, Trümmer, Collider)
    this.props = physics ? new PropSystem(scene, this.budget, this.fx, (t, x, z) => t.heightAt(x, z) ?? 0) : null;
    if (this.props) this.tiles.addLayer(this.props.layer);
    game.camera.detachControl();
    game.camera.maxZ = 2600;
    this.panorama = createPanorama(scene, scene.fogColor);
    this.player = new PlayerController(scene, game.camera, this.tiles, new Vector3(start.x, 0, start.z), physics);
    this.player.vehicles = this.vehicles;
    this.unsubs.push(useGameStore.subscribe((st) => (this.player.simpleDriving = st.simpleDriving)));
    this.player.simpleDriving = useGameStore.getState().simpleDriving;
    // Höhe beim Start: so hoch, bis die erste Kachel da ist
    this.unsubs.push(game.onFrame((dt) => this.update(dt)));
    this.unsubs.push(game.onQualityChange((qq) => this.applyQuality(qq)));
  }

  private update(dt: number): void {
    const p = this.player.position;
    const v = this.player.velocity;
    this.tiles.update(p.x, p.z, v.x, v.z);
    this.player.update(dt);
    this.vehicles?.update(p.x, p.z);
    this.props?.update(collectPropActors(this.player, this.vehicles), p.x, p.z, this.player.state.kind === 'walking');
    this.publishPlayState();
    this.budget.update();
    if (this.debug.enabled) {
      const from = p.add(new Vector3(0, 1, 0));
      this.debug.line(from, from.add(v.scale(0.5)), DEBUG_COLORS.velocity);
    }
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

  private lastPublish = 0;

  /** Spielzustand für die UI (gedrosselt auf 4 Hz). */
  private publishPlayState(): void {
    const now = performance.now();
    if (now - this.lastPublish < 250) return;
    this.lastPublish = now;
    const v = this.player.vehicle;
    useGameStore.getState().setPlay({
      mode: v ? 'driving' : 'walking',
      canEnter: this.player.canEnter,
      vehicleHealth: v ? Math.round(v.health * 100) / 100 : 1,
      speedKmh: v ? Math.round(Math.abs(v.sim.forwardSpeed) * 3.6) : 0,
    });
  }

  private applyQuality(q: QualitySettings): void {
    this.tiles?.setQuality(q.viewDistance, q.vegetationDensity);
    if (this.fx) this.fx.lowQuality = q.level === 'low';
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
      for (const m of this.player?.walker.figure.meshes ?? [])
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
    this.vehicles?.dispose();
    this.props?.dispose();
    this.fx.dispose();
    this.budget.dispose();
    this.debug.dispose();
    this.tiles.dispose();
    this.pool.dispose();
    this.panorama.dispose();
    this.materials.dispose();
    this.fxaa?.dispose(this.game.camera);
    this.shadows?.dispose();
    if (this.physics) releaseHavok(this.game.scene);
  }
}
