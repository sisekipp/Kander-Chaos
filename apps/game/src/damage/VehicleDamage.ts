import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate';
import {
  PhysicsShapeType,
  PhysicsEventType,
  type IPhysicsCollisionEvent,
} from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import type { Observer } from '@babylonjs/core/Misc/observable';
import type { Scene } from '@babylonjs/core/scene';
import type { Vehicle } from '../vehicles/Vehicle.ts';
import { GROUP, DEBRIS_COLLIDES } from '../vehicles/physics/collisionGroups.ts';
import type { PhysicsBudget } from '../engine/physics/budget/index.ts';
import type { Particles } from '../engine/fx/particles.ts';
import { DamageState, type ImpactPartner } from './model.ts';
import { damageLook } from './stages.ts';

/** Verbindet Havok-Kollisionen eines Fahrzeugs mit dem Schadensmodell und zeigt die Stufen (Design D4). */
export class VehicleDamage {
  readonly state = new DamageState();
  private partsOff = 0;
  private obs: Observer<IPhysicsCollisionEvent> | null = null;
  onWrecked: ((v: Vehicle) => void) | null = null;

  constructor(
    private readonly scene: Scene,
    private readonly vehicle: Vehicle,
    private readonly budget: PhysicsBudget,
    private readonly fx: Particles,
  ) {}

  /** Kollisionsereignisse nur für dynamische Fahrzeuge (statische melden keine eigenen Kontakte). */
  setListening(on: boolean): void {
    const body = this.vehicle.sim.body;
    if (on && !this.obs) {
      body.setCollisionCallbackEnabled(true);
      this.obs = body.getCollisionObservable().add((e) => this.onCollision(e));
    } else if (!on && this.obs) {
      body.getCollisionObservable().remove(this.obs);
      body.setCollisionCallbackEnabled(false);
      this.obs = null;
    }
  }

  private onCollision(e: IPhysicsCollisionEvent): void {
    if (e.type !== PhysicsEventType.COLLISION_STARTED || !e.normal) return;
    const other = e.collidedAgainst === this.vehicle.sim.body ? e.collider : e.collidedAgainst;
    // Welt-Körper (Gelände, Gebäude) haben die Standardmaske (alle Bits) -> nur exakte Gruppen vergleichen
    const mask = other.shape?.filterMembershipMask ?? GROUP.WORLD;
    if (mask === GROUP.DEBRIS || mask === GROUP.CHARACTER) return;
    const partner: ImpactPartner = mask === GROUP.PROP ? 'prop' : mask === GROUP.VEHICLE ? 'vehicle' : 'world';
    const otherV = new Vector3();
    if (other.getMotionType() === 2) other.getLinearVelocityToRef(otherV);
    const rel = this.vehicle.sim.lastVelocity.subtract(otherV);
    const kmh = Math.abs(Vector3.Dot(rel, e.normal)) * 3.6;
    this.applyHit(kmh, partner, e.point ?? this.vehicle.position);
  }

  /** Aufprall anwenden (auch direkt aus Tests oder bei Kleinobjekt-Treffern). */
  applyHit(kmh: number, partner: ImpactPartner, at: Vector3): void {
    const d = this.state.hit(performance.now(), kmh, partner);
    if (d <= 0) return;
    this.vehicle.health = this.state.health;
    if (kmh > 25) this.fx.burst(at, 'sparks', 20);
    this.refresh();
  }

  private refresh(): void {
    const m = this.vehicle.sim.model;
    const look = damageLook(this.state.health, m.detachable.length);
    m.material.diffuseColor = new Color3(look.tint, look.tint, look.tint);
    while (this.partsOff < look.partsOff) this.detach(m.detachable[this.partsOff++]);
    this.fx.smoke(
      this.vehicle,
      look.smoke === 'none' ? null : m.body,
      look.smoke === 'none' ? null : look.smoke === 'thick',
    );
    if (look.wrecked && !this.vehicle.wrecked) {
      this.vehicle.wrecked = true;
      this.vehicle.sim.wrecked = true;
      this.fx.burst(this.vehicle.position.add(new Vector3(0, 0.8, 0)), 'puff', 60);
      const body = this.vehicle.sim.body;
      body.applyImpulse(new Vector3(0, this.vehicle.sim.spec.mass * 3, 0), this.vehicle.position); // kleiner Hüpfer
      for (const w of m.wheels) w.setEnabled(false); // Räder fliegen „weg“ (ausgeblendet)
      this.onWrecked?.(this.vehicle);
    }
  }

  /** Teil abkoppeln: wird ein kleiner dynamischer Körper und verschwindet nach Ruhe (Budget „part“). */
  private detach(part: (typeof this.vehicle.sim.model.detachable)[number] | undefined): void {
    if (!part || part.isDisposed()) return;
    part.setParent(null);
    const agg = new PhysicsAggregate(
      part,
      PhysicsShapeType.BOX,
      { mass: 8, friction: 0.6, restitution: 0.3 },
      this.scene,
    );
    agg.shape.filterMembershipMask = GROUP.DEBRIS;
    agg.shape.filterCollideMask = DEBRIS_COLLIDES;
    const v = this.vehicle.sim.lastVelocity;
    agg.body.setLinearVelocity(
      new Vector3(v.x * 0.5 + (Math.random() - 0.5) * 3, 3 + Math.random() * 2, v.z * 0.5 + (Math.random() - 0.5) * 3),
    );
    this.budget.register('part', {
      body: agg.body,
      node: part,
      dispose: () => {
        agg.dispose();
        part.dispose();
      },
    });
  }

  dispose(): void {
    this.setListening(false);
    this.fx.smoke(this.vehicle, null, null);
  }
}
