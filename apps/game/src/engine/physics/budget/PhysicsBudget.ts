import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { PhysicsBody } from '@babylonjs/core/Physics/v2/physicsBody';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { BodyBudget, type BodyKind, type BudgetAction } from './logic.ts';

/** Ein vom Budget verwalteter dynamischer Körper. Besitzer liefert, wie er entfernt bzw. eingefroren wird. */
export interface ManagedBody {
  body: PhysicsBody;
  /** Wird beim Ausblenden verkleinert. */
  node: TransformNode;
  dispose(): void;
  /** Zu einem statischen Objekt machen (nur Props); ohne Angabe wird entfernt. */
  freeze?(): void;
}

const REST_LINEAR = 0.25;
const REST_ANGULAR = 0.3;
const FADE_MS = 400;

/** Babylon-Anbindung des Physik-Budgets: Ruheerkennung, Ausblenden, Einfrieren, Entfernen. */
export class PhysicsBudget {
  readonly logic = new BodyBudget();
  private readonly bodies = new Map<number, ManagedBody>();
  private readonly fading = new Map<number, { start: number; scale: Vector3; m: ManagedBody }>();
  private readonly v = new Vector3();
  private readonly w = new Vector3();

  get count(): number {
    return this.logic.count;
  }

  countOf(kind: BodyKind): number {
    return this.logic.countOf(kind);
  }

  register(kind: BodyKind, m: ManagedBody, now = performance.now()): number {
    const { id, actions } = this.logic.add(kind, now);
    this.bodies.set(id, m);
    this.apply(actions, now);
    return id;
  }

  /** Besitzer hat den Körper selbst entfernt. */
  unregister(id: number): void {
    this.logic.remove(id);
    this.bodies.delete(id);
    this.fading.delete(id);
  }

  update(now = performance.now()): void {
    for (const [id, m] of this.bodies) {
      if (this.fading.has(id)) continue;
      m.body.getLinearVelocityToRef(this.v);
      m.body.getAngularVelocityToRef(this.w);
      this.logic.setResting(id, this.v.length() < REST_LINEAR && this.w.length() < REST_ANGULAR, now);
    }
    this.apply(this.logic.tick(now), now);
    for (const [id, f] of this.fading) {
      const t = Math.min(1, (now - f.start) / FADE_MS);
      f.m.node.scaling.copyFrom(f.scale).scaleInPlace(Math.max(0.001, 1 - t));
      if (t >= 1) this.finish(id, () => f.m.dispose());
    }
  }

  private apply(actions: BudgetAction[], now: number): void {
    for (const a of actions) {
      const m = this.bodies.get(a.id);
      if (!m) continue;
      if (a.action === 'fade') this.fading.set(a.id, { start: now, scale: m.node.scaling.clone(), m });
      else if (a.action === 'freeze' && m.freeze) this.finish(a.id, () => m.freeze!());
      else this.finish(a.id, () => m.dispose());
    }
  }

  private finish(id: number, fn: () => void): void {
    this.unregister(id);
    fn();
  }

  dispose(): void {
    for (const m of this.bodies.values()) m.dispose();
    this.bodies.clear();
    this.fading.clear();
  }
}
