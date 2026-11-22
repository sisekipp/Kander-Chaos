import type { Scene } from '@babylonjs/core/scene';
import type { TileManager } from '../world/tiles/TileManager.ts';
import type { DebugLines } from '../engine/debug/DebugLines.ts';
import { PHYSICS_STEP_MS } from '../engine/physics/fixedStep.ts';
import { ParkingLayer, spotsOf } from './ParkingLayer.ts';
import { VehicleSelection, type Spot } from './selection.ts';
import { Vehicle } from './Vehicle.ts';
import type { PhysicsBudget } from '../engine/physics/budget/index.ts';
import type { Particles } from '../engine/fx/particles.ts';
import { VehicleDamage } from '../damage/VehicleDamage.ts';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

/** Wracks verschwinden nach 20 s mit einer Rauchwolke (Spec vehicle-damage). */
export const WRECK_REMOVE_MS = 20_000;

/**
 * Besetzt Parkpositionen der Ring-0-Kacheln mit Fahrzeugen (max. 24), verteilt volle Physik (max. 8),
 * merkt bewegte Fahrzeuge und das zuletzt gefahrene (Design D3).
 */
export class VehicleManager {
  readonly selection = new VehicleSelection();
  readonly layer: ParkingLayer;
  private readonly vehicles = new Map<number, Vehicle>();
  private readonly damage = new Map<number, VehicleDamage>();
  private drivenId: number | null = null;
  private lastDrivenId: number | null = null;
  private lastSelect = -Infinity;
  private readonly obsStep;
  private readonly obsRender;

  constructor(
    private readonly scene: Scene,
    private readonly tiles: TileManager,
    private readonly debug: DebugLines | null,
    private readonly budget: PhysicsBudget,
    private readonly fx: Particles,
  ) {
    this.layer = new ParkingLayer((tileId, ids) => this.onTileUnload(tileId, ids));
    this.obsStep = scene.onBeforePhysicsObservable.add(() => {
      for (const v of this.vehicles.values()) v.sim.step(PHYSICS_STEP_MS / 1000);
    });
    this.obsRender = scene.onBeforeRenderObservable.add(() => {
      for (const v of this.vehicles.values()) if (v.sim.isDynamic) v.sim.updateVisuals();
    });
  }

  get count(): number {
    return this.vehicles.size;
  }

  get dynamicCount(): number {
    let n = 0;
    for (const v of this.vehicles.values()) if (v.sim.isDynamic) n++;
    return n;
  }

  all(): IterableIterator<Vehicle> {
    return this.vehicles.values();
  }

  get(id: number): Vehicle | undefined {
    return this.vehicles.get(id);
  }

  /** Nächstes benutzbares Fahrzeug innerhalb von `maxDist` (für den Einsteigen-Knopf). */
  nearest(x: number, z: number, maxDist: number): Vehicle | null {
    let best: Vehicle | null = null,
      bd = maxDist * maxDist;
    for (const v of this.vehicles.values()) {
      if (v.wrecked || v.id === this.drivenId) continue;
      const d = (v.position.x - x) ** 2 + (v.position.z - z) ** 2;
      if (d <= bd) {
        bd = d;
        best = v;
      }
    }
    return best;
  }

  setDriven(v: Vehicle | null): void {
    if (this.drivenId !== null) this.vehicles.get(this.drivenId)?.sim.setKeepAwake(false);
    this.drivenId = v?.id ?? null;
    if (v) {
      v.sim.setKeepAwake(true);
      this.lastDrivenId = v.id;
      v.moved = true;
      v.awake = true;
      v.sim.setDynamic(true);
      v.sim.debug = this.debug;
    }
  }

  /** Pro Bild aufrufen. */
  update(px: number, pz: number, now = performance.now()): void {
    // Angestoßene erkennen: ruhende Fahrzeuge nahe an einem bewegten werden geweckt
    const moving = [...this.vehicles.values()].filter((v) => v.sim.isDynamic && v.speed > 1);
    for (const v of this.vehicles.values()) {
      if (v.sim.isDynamic) {
        if (v.speed > 0.5) v.awake = true;
        continue;
      }
      if (moving.some((m) => m !== v && (m.position.x - v.position.x) ** 2 + (m.position.z - v.position.z) ** 2 < 25))
        v.awake = true;
    }
    if (now - this.lastSelect > 400) {
      this.lastSelect = now;
      this.select(px, pz, now);
    }
    const dyn = this.selection.chooseDynamic(
      [...this.vehicles.values()].map((v) => ({ id: v.id, x: v.position.x, z: v.position.z, awake: v.awake })),
      px,
      pz,
      this.drivenId,
    );
    for (const v of this.vehicles.values()) {
      v.sim.setDynamic(dyn.has(v.id));
      this.damage.get(v.id)?.setListening(dyn.has(v.id));
      if (!dyn.has(v.id) && v.id !== this.drivenId && !v.wrecked) v.awake = false;
      if (v.wreckedAt !== null && now - v.wreckedAt >= WRECK_REMOVE_MS) {
        this.fx.burst(v.position.add(new Vector3(0, 0.6, 0)), 'puff', 50);
        this.selection.markDestroyed(v.id, now);
        this.remove(v);
      }
    }
  }

  /** Schadenszustand eines Fahrzeugs (für Tests und Kleinobjekt-Treffer). */
  damageOf(v: Vehicle): VehicleDamage | undefined {
    return this.damage.get(v.id);
  }

  private track(v: Vehicle): void {
    const d = new VehicleDamage(this.scene, v, this.budget, this.fx);
    d.onWrecked = (veh) => {
      veh.wreckedAt = performance.now();
      veh.awake = true;
      veh.moved = true; // Wrack bleibt, wo es ist, bis es verschwindet
    };
    this.damage.set(v.id, d);
  }

  private select(px: number, pz: number, now: number): void {
    const spots: Spot[] = [];
    for (const t of this.tiles.tiles) spots.push(...spotsOf(t));
    this.selection.observe(spots, px, pz, now);
    const kept = [...this.vehicles.values()].filter((v) => v.moved);
    const chosen = this.selection.chooseSpots(
      spots.filter((s) => !this.vehicles.get(s.id)?.moved),
      px,
      pz,
      now,
      kept.length,
    );
    const want = new Set(chosen.map((s) => s.id));
    for (const [id, v] of this.vehicles) {
      if (v.moved) {
        const keep =
          id === this.drivenId ||
          (id === this.lastDrivenId
            ? this.selection.keepLastDriven(v.position.x, v.position.z, px, pz)
            : !!this.tiles.tileAt(v.position.x, v.position.z));
        if (keep) continue;
      } else if (want.has(id)) continue;
      this.remove(v);
    }
    for (const s of chosen) {
      if (this.vehicles.has(s.id)) continue;
      const gy = this.tiles.heightAt(s.x, s.z);
      if (gy === null) continue;
      const v = new Vehicle(this.scene, s.id, s.kind, s.tileId, s.x, gy, s.z, s.heading);
      this.vehicles.set(s.id, v);
      this.track(v);
    }
  }

  /** Fahrzeug zerstört (Schaden): Stelle sperren, Wrack verschwindet später. */
  markDestroyed(v: Vehicle, now = performance.now()): void {
    this.selection.markDestroyed(v.id, now);
  }

  remove(v: Vehicle): void {
    if (this.drivenId === v.id) this.drivenId = null;
    this.damage.get(v.id)?.dispose();
    this.damage.delete(v.id);
    v.dispose();
    this.vehicles.delete(v.id);
  }

  private onTileUnload(_tileId: string, ids: number[]): void {
    this.selection.tileUnloaded(ids);
  }

  dispose(): void {
    this.scene.onBeforePhysicsObservable.remove(this.obsStep);
    this.scene.onBeforeRenderObservable.remove(this.obsRender);
    for (const v of Array.from(this.vehicles.values())) this.remove(v); // Kopie: remove() verändert die Map
  }
}
