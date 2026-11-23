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
import type { QualitySettings } from '../engine/quality.ts';
import { PlayerController } from '../player/PlayerController.ts';
import { RouteFollower } from '../player/route.ts';
import { FAST_SPEED } from '../player/constants.ts';
import { createWorldMaterials, type WorldMaterials } from './worldMaterials.ts';
import { TileManager } from './tiles/TileManager.ts';
import { LandmarkLayer } from './landmarks/LandmarkLayer.ts';
import type { LandmarkInfo } from './landmarks/placement.ts';
import { WorkerPool } from './WorkerPool.ts';
import { createPanorama } from './panorama.ts';
import { flightRoute } from '../fly/autopilot.ts';
import { FlySession } from '../fly/FlySession.ts';

export { WORLD_URL, loadWorldIndex, type Place } from './worldSetup.ts';
import { createTiles, loadWorldIndex, WORLD_URL, type Place } from './worldSetup.ts';
import { attachRemoteModels, createPackSource } from '../offline/regions.ts';
import { RegionBorder } from './regionBorder.ts';
import { FarView } from './far/FarView.ts';
import type { PackSource } from '../offline/packSource.ts';
import { HeliSystem, type HelipadInfo } from '../vehicles/helicopter/HeliSystem.ts';
import { getModels } from '../assets/ModelRegistry.ts';
import { consumeAction, input } from '../player/input.ts';

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
  readonly landmarks: LandmarkLayer;
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
    const { index, places, landmarks, helipads } = await loadWorldIndex();
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
    const packs = await createPackSource(index, WORLD_URL).catch(() => null);
    const models = getModels();
    if (models) await attachRemoteModels(models, index.buildVersion).catch(() => {});
    return new World(game, index, places, physics, opts.start ?? fromSave ?? index.spawn, landmarks, helipads, packs);
  }

  private constructor(
    private readonly game: Game,
    readonly index: WorldIndex,
    readonly places: Place[],
    readonly physics: boolean,
    start: { x: number; z: number },
    landmarkList: LandmarkInfo[] = [],
    helipads: HelipadInfo[] = [],
    packs: PackSource | null = null,
  ) {
    const scene = game.scene;
    this.materials = createWorldMaterials(scene);
    this.pool = new WorkerPool();
    ({ tiles: this.tiles, landmarks: this.landmarks } = createTiles(
      game,
      index,
      this.pool,
      this.materials,
      physics,
      landmarkList,
      packs,
    ));
    this.debug = new DebugLines(scene);
    if (physics) this.unsubs.push(enableFixedPhysicsSteps(scene));
    this.unsubs.push(useGameStore.subscribe((st) => (this.debug.enabled = st.debugPhysics)));
    this.debug.enabled = useGameStore.getState().debugPhysics;
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
    void FarView.load(scene, WORLD_URL, landmarkList).then((f) => (this.disposedFar ? f?.dispose() : (this.far = f)));
    this.player = new PlayerController(scene, game.camera, this.tiles, new Vector3(start.x, 0, start.z), physics);
    this.player.vehicles = this.vehicles;
    this.unsubs.push(useGameStore.subscribe((st) => (this.player.simpleDriving = st.simpleDriving)));
    this.player.simpleDriving = useGameStore.getState().simpleDriving;
    this.heli = new HeliSystem(scene, this.tiles, this.player, getModels(), helipads, this.worldBounds());
    if (packs)
      this.border = new RegionBorder(this.tiles, index.tileSize, this.player, this.heli, () =>
        this.fly?.flying ? this.fly.controllerState : null,
      );
    // Höhe beim Start: so hoch, bis die erste Kachel da ist
    this.unsubs.push(game.onFrame((dt) => this.update(dt)));
    this.unsubs.push(game.onQualityChange((qq) => this.applyQuality(qq)));
  }

  private fly: FlySession | null = null;
  private border: RegionBorder | null = null;
  /** Fernsicht im Flug (öffentlich für Tests). */
  far: FarView | null = null;
  private disposedFar = false;
  /** Hubschrauber auf Landeplätzen (Spec helicopter). */
  readonly heli: HeliSystem;

  /** Weltgrenzen in m (aus dem Kachelindex). */
  private worldBounds() {
    const b = this.index.bounds,
      s = this.index.tileSize;
    return { minX: b.minTx * s, minZ: b.minTz * s, maxX: (b.maxTx + 1) * s, maxZ: (b.maxTz + 1) * s };
  }

  /** Flugmodus starten (nur zu Fuß, nicht im Hubschrauber). */
  startFlying(): boolean {
    if (this.fly?.flying || this.heli.flying || this.player.state.kind !== 'walking') return false;
    this.fly = new FlySession(this.game.scene, this.game.camera, this.tiles, this.player, this.worldBounds());
    useGameStore.getState().setFlying(true);
    return true;
  }

  /** Flugmodus beenden: zurück zur Figur oder hier landen. */
  stopFlying(land = false): void {
    if (!this.fly?.flying) return;
    if (land) this.fly.land();
    else this.fly.back();
    useGameStore.getState().setFlying(false);
  }

  get flying(): boolean {
    return this.fly?.flying ?? false;
  }

  /** Messroute „Flug“ (Kernstadt → Wollbach → zurück) im Flugmodus starten. */
  startFlightRoute(town = 'Kandern', village = 'Wollbach'): boolean {
    const a = this.places.find((p) => p.name === town),
      b = this.places.find((p) => p.name === village);
    if (!a || !b || (!this.fly?.flying && !this.startFlying())) return false;
    this.fly?.controllerState?.startRoute(flightRoute(a, b));
    return true;
  }

  private update(dt: number): void {
    const focus = this.fly?.update(dt) ?? this.heli.update(dt);
    if (this.fly && !this.fly.active) this.fly = null;
    const p = this.player.position;
    const v = this.player.velocity;
    if (focus) this.tiles.update(focus.x, focus.z, focus.vx, focus.vz, focus.fullDetail);
    else this.tiles.update(p.x, p.z, v.x, v.z);
    this.fly?.checkLanding();
    if (input.action && this.heli.canEnter) {
      consumeAction();
      this.heli.enter();
    }
    this.player.update(dt);
    this.border?.update(dt);
    this.vehicles?.update(p.x, p.z);
    this.props?.update(collectPropActors(this.player, this.vehicles), p.x, p.z, this.player.state.kind === 'walking');
    this.publishPlayState();
    this.budget.update();
    if (this.debug.enabled) {
      const from = p.add(new Vector3(0, 1, 0));
      this.debug.line(from, from.add(v.scale(0.5)), DEBUG_COLORS.velocity);
    }
    this.far?.frame(dt, focus, (x, z) => this.tiles.tileAt(x, z)?.ring ?? null, this.game, this.panorama.mesh);
    if (focus) this.panorama.follow(focus.x, focus.z, focus.y - 60);
    else this.panorama.follow(p.x, p.z, p.y - 60);
    this.materials.setFog(this.game.scene.fogStart, this.game.scene.fogEnd);
    this.materials.setTime(performance.now() / 1000);
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
      canEnter: this.player.canEnter || this.heli.canEnter,
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
    return this.player.route !== null || !!this.fly?.controllerState?.routeActive || this.heli.routeActive;
  }

  dispose(): void {
    useGameStore.getState().setFlying(false);
    for (const u of this.unsubs) u();
    this.player.dispose();
    this.vehicles?.dispose();
    this.props?.dispose();
    this.heli.dispose();
    this.landmarks.dispose();
    this.fx.dispose();
    this.budget.dispose();
    this.debug.dispose();
    this.tiles.dispose();
    this.pool.dispose();
    this.panorama.dispose();
    this.disposedFar = true;
    this.far?.dispose();
    this.materials.dispose();
    this.fxaa?.dispose(this.game.camera);
    this.shadows?.dispose();
    if (this.physics) releaseHavok(this.game.scene);
  }
}
