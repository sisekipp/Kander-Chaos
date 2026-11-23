import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { PhysicsRaycastResult } from '@babylonjs/core/Physics/physicsRaycastResult';
import type { PhysicsEngine } from '@babylonjs/core/Physics/v2/physicsEngine';
import type { Scene } from '@babylonjs/core/scene';
import type { ModelRegistry } from '../../assets/ModelRegistry.ts';
import { createVertexColorMaterial } from '../../engine/procedural/PartKit.ts';
import { fullDetailFor } from '../../fly/detailRule.ts';
import type { FlyFocus } from '../../fly/FlyController.ts';
import { input } from '../../player/input.ts';
import type { PlayerController } from '../../player/PlayerController.ts';
import { useGameStore } from '../../state/store.ts';
import type { TileManager } from '../../world/tiles/TileManager.ts';
import { pickFor } from '../../assets/palette.ts';
import { Helicopter } from './Helicopter.ts';
import { buildHelicopterModel, buildHelipad, HELI_PAINTS } from './HelicopterModel.ts';
import { canExit, canLandAt, exitPoints } from './heliLanding.ts';
import type { HeliEnv } from './heliMath.ts';
import { autopilot, type FlyWaypoint } from '../../fly/autopilot.ts';
import { heliBaselRoute } from './heliRoute.ts';

export interface HelipadInfo {
  id: string;
  name: string;
  x: number;
  z: number;
  heading: number;
}

const ENTER_RANGE = 7;
const SPAWN_RANGE = 400;
const DESPAWN_RANGE = 700;
const ray = new PhysicsRaycastResult();

/**
 * Hubschrauber im Spiel (Spec helicopter): stellt auf Landeplätzen in der Nähe Hubschrauber bereit, steuert
 * Ein- und Aussteigen, Flug, Verfolgerkamera, Gebäudekollision und liefert den Streaming-Mittelpunkt.
 */
export class HeliSystem {
  private readonly parked = new Map<string, { pad: TransformNode | null; heli: Helicopter }>();
  private readonly material: StandardMaterial;
  active: Helicopter | null = null;
  private detail = true;
  private lastGround = 0;
  private sinceSpawn = 1e9;
  private route: { points: FlyWaypoint[]; index: number } | null = null;
  /** Messroute angefordert: am Landeplatz Kandern einsteigen, sobald der Hubschrauber bereitsteht. */
  private routePending = false;

  constructor(
    private readonly scene: Scene,
    private readonly tiles: TileManager,
    private readonly player: PlayerController,
    private readonly registry: ModelRegistry | null,
    private readonly pads: HelipadInfo[],
    private readonly bounds: HeliEnv['bounds'],
  ) {
    this.material = createVertexColorMaterial(scene, 'heli-mat');
  }

  /** Alle bereitstehenden bzw. abgestellten Hubschrauber (Tests, Debug). */
  get all(): Helicopter[] {
    return [...this.parked.values()].map((p) => p.heli);
  }

  get flying(): boolean {
    return this.active !== null;
  }

  private nearest(): Helicopter | null {
    const p = this.player.walker.position;
    let best: Helicopter | null = null,
      bd = ENTER_RANGE;
    for (const { heli } of this.parked.values()) {
      const d = Math.hypot(heli.position.x - p.x, heli.position.z - p.z);
      if (d < bd && heli.state.grounded) {
        best = heli;
        bd = d;
      }
    }
    return best;
  }

  /** Zu Fuß in Reichweite eines stehenden Hubschraubers? */
  get canEnter(): boolean {
    return !this.active && this.player.state.kind === 'walking' && !this.player.suspended && !!this.nearest();
  }

  get canExit(): boolean {
    const a = this.active;
    return !!a && canExit(a.state.y, this.groundAt(a.state.x, a.state.z));
  }

  enter(): boolean {
    const heli = this.canEnter ? this.nearest() : null;
    if (!heli) return false;
    this.active = heli;
    this.player.suspend();
    this.player.walker.figure.setVisible(false);
    this.player.rig.setMode('chase');
    this.player.rig.zoom = { min: 16, max: 30 };
    useGameStore.getState().setHeli(true);
    return true;
  }

  exit(): boolean {
    const a = this.active;
    if (!a || !this.canExit) return false;
    const spot =
      exitPoints(a.state.x, a.state.z, a.state.heading).find(
        ([x, z]) => (this.topAt(x, z) ?? -Infinity) <= this.groundAt(x, z) + 0.5,
      ) ?? exitPoints(a.state.x, a.state.z, a.state.heading)[0];
    this.active = null;
    this.player.walker.figure.setVisible(true);
    this.player.rig.zoom = { min: 7, max: 14 };
    this.player.rig.setMode('walk');
    this.player.resume({ x: spot[0], z: spot[1] });
    useGameStore.getState().setHeli(false);
    input.flyUp = input.flyDown = false;
    return true;
  }

  /** Messroute „Hubschrauber Basel“ starten (Figur wird zum Landeplatz Kandern gesetzt). */
  startBaselRoute(): boolean {
    const points = heliBaselRoute(this.pads);
    const start = this.pads.find((p) => p.id === 'kandern');
    if (!points || !start || this.active) return false;
    this.player.teleport(start.x + 5, start.z);
    this.route = { points, index: 0 };
    this.routePending = true;
    return true;
  }

  get routeActive(): boolean {
    return this.route !== null;
  }

  private groundAt(x: number, z: number): number {
    const h = this.tiles.heightAt(x, z);
    if (h !== null) this.lastGround = h;
    return h ?? this.lastGround;
  }

  /** Oberste Fläche (Dach) über dem Gelände per Raycast, null ohne Physik oder ohne Treffer. */
  private topAt(x: number, z: number): number | null {
    const engine = this.scene.getPhysicsEngine() as PhysicsEngine | null;
    if (!engine) return null;
    const g = this.groundAt(x, z);
    engine.raycastToRef(new Vector3(x, g + 80, z), new Vector3(x, g - 1, z), ray);
    return ray.hasHit ? ray.hitPointWorld.y : null;
  }

  private env(): HeliEnv {
    return {
      groundAt: (x, z) => this.groundAt(x, z),
      canLand: (x, z) => {
        const a = this.active;
        // Prüfung nur kurz über dem Boden (spart Raycasts im Flug)
        if (a && a.state.y - this.groundAt(x, z) > 12) return true;
        return canLandAt(
          x,
          z,
          (xx, zz) => this.groundAt(xx, zz),
          (xx, zz) => this.topAt(xx, zz),
        );
      },
      bounds: this.bounds,
    };
  }

  /** Gebäude vor dem Hubschrauber: Geschwindigkeit in Wandrichtung aufheben und sanft zurückschieben. */
  private collide(h: Helicopter, dt: number): void {
    const s = h.state;
    const v = Math.hypot(s.vx, s.vz);
    const engine = this.scene.getPhysicsEngine() as PhysicsEngine | null;
    if (!engine || v < 0.5) return;
    const dx = s.vx / v,
      dz = s.vz / v;
    const reach = v * dt + 6;
    for (const up of [0.6, 1.8, 3.2]) {
      const from = new Vector3(s.x, s.y + up, s.z);
      engine.raycastToRef(from, from.add(new Vector3(dx * reach, 0, dz * reach)), ray);
      // Nur steile Flächen (Wände) bremsen; Hänge überfliegt der Hubschrauber, er hebt sich mit dem Gelände
      if (!ray.hasHit || ray.hitNormalWorld.y > 0.5) continue;
      const back = reach - Vector3.Distance(from, ray.hitPointWorld);
      h.state = {
        ...s,
        vx: -dx * 2,
        vz: -dz * 2,
        x: s.x - dx * Math.max(0, back) * 0.5,
        z: s.z - dz * Math.max(0, back) * 0.5,
      };
      return;
    }
  }

  private spawnNear(x: number, z: number): void {
    if (!this.registry || !this.registry.ids.includes('helicopter')) return;
    for (const pad of this.pads) {
      const d = Math.hypot(pad.x - x, pad.z - z);
      const entry = this.parked.get(pad.id);
      if (!entry && d < SPAWN_RANGE && this.tiles.isReady(pad.x, pad.z)) {
        const g = this.groundAt(pad.x, pad.z);
        const padNode = this.registry.ids.includes('helipad')
          ? buildHelipad(this.scene, this.registry, this.material, `helipad-${pad.id}`)
          : null;
        padNode?.position.set(pad.x, g, pad.z);
        const paint = pickFor(pad.id.length * 7919, HELI_PAINTS, 3);
        const model = buildHelicopterModel(this.scene, this.registry, this.material, paint, `heli-${pad.id}`);
        this.parked.set(pad.id, {
          pad: padNode,
          heli: new Helicopter(pad.id, model, pad.x, g + 0.15, pad.z, pad.heading),
        });
      } else if (entry && d > DESPAWN_RANGE && entry.heli !== this.active && !entry.heli.moved) {
        entry.pad?.dispose(false, false);
        entry.heli.dispose();
        this.parked.delete(pad.id);
      }
    }
  }

  /** Pro Bild: Hubschrauber bewegen; liefert im Flug den Streaming-Mittelpunkt (sonst null). */
  update(dtMs: number): FlyFocus | null {
    const a = this.active;
    const center = a ? a.position : this.player.walker.position;
    this.sinceSpawn += dtMs;
    if (this.sinceSpawn > 500) {
      this.sinceSpawn = 0;
      this.spawnNear(center.x, center.z);
    }
    const env = this.env();
    for (const { heli } of this.parked.values()) {
      if (heli === a) continue;
      heli.update(dtMs, null, env);
    }
    if (this.routePending && !a && this.canEnter) {
      this.routePending = false;
      this.enter();
    }
    if (!a) return null;
    const dt = Math.min(dtMs, 100) / 1000;
    let control = {
      moveX: input.moveX,
      moveY: input.moveY,
      up: input.flyUp,
      down: input.flyDown,
      fast: input.fast,
      camYaw: this.player.rig.forwardYaw,
      engine: true,
    };
    const r = this.route;
    // Autopilot erst nach dem Rotoranlauf
    if (r && a.state.rotor > 0.9) {
      const step = autopilot(a.state, this.groundAt(a.state.x, a.state.z), r.points, r.index, a.state.heading);
      r.index = step.index;
      if (step.done) this.route = null;
      control = { ...step.input, camYaw: step.input.yaw, engine: true };
    }
    a.update(dtMs, control, env);
    this.collide(a, dt);
    const s = a.state;
    const speed = Math.hypot(s.vx, s.vz);
    this.player.rig.update(dtMs, new Vector3(s.x, s.y + 2.2, s.z), s.heading, speed);
    this.detail = fullDetailFor(this.detail, s.y - this.groundAt(s.x, s.z));
    return { x: s.x, y: s.y, z: s.z, vx: s.vx, vz: s.vz, fullDetail: this.detail };
  }

  dispose(): void {
    for (const { pad, heli } of this.parked.values()) {
      pad?.dispose(false, false);
      heli.dispose();
    }
    this.parked.clear();
    this.material.dispose();
    useGameStore.getState().setHeli(false);
  }
}
