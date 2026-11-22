import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { PhysicsBody } from '@babylonjs/core/Physics/v2/physicsBody';
import { PhysicsShapeBox } from '@babylonjs/core/Physics/v2/physicsShape';
import { PhysicsMotionType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import type { Scene } from '@babylonjs/core/scene';
import { GROUP } from '../vehicles/physics/collisionGroups.ts';
import { PROP_EXTENTS } from './models/index.ts';
import type { TileProps, WorldPropRef } from './PropLayer.ts';
import { PROP_RULES } from './triggers.ts';

const ADD_RADIUS = 30;
const REMOVE_RADIUS = 35;

/**
 * Statische Collider für blockierende Kleinobjekte (Laterne, Schild, Bank) nur im Nahbereich der
 * Figur zu Fuß – so bleibt die Zahl statischer Körper klein (Design D5). Beim Fahren keine Collider,
 * damit Fahrzeuge die Objekte über die Trefferprüfung auslösen statt abzuprallen.
 */
export class PropColliders {
  private readonly active = new Map<string, { body: PhysicsBody; node: TransformNode }>();

  constructor(private readonly scene: Scene) {}

  get count(): number {
    return this.active.size;
  }

  update(tiles: Iterable<TileProps>, px: number, pz: number, walking: boolean): void {
    const keep = new Set<string>();
    if (walking) {
      for (const t of tiles) {
        for (const p of t.props) {
          if (!PROP_RULES[p.kind].blocksWalker || t.rebuild.isDestroyed(p.index)) continue;
          const d2 = (p.x - px) ** 2 + (p.z - pz) ** 2;
          const key = `${t.tileId}:${p.index}`;
          if (d2 <= ADD_RADIUS ** 2 || (d2 <= REMOVE_RADIUS ** 2 && this.active.has(key))) {
            keep.add(key);
            if (!this.active.has(key)) this.active.set(key, this.create(p, key));
          }
        }
      }
    }
    for (const [key, c] of this.active) if (!keep.has(key)) this.removeKey(key, c);
  }

  /** Collider eines ausgelösten Objekts sofort entfernen. */
  remove(tileId: string, index: number): void {
    const key = `${tileId}:${index}`;
    const c = this.active.get(key);
    if (c) this.removeKey(key, c);
  }

  private create(p: WorldPropRef, key: string): { body: PhysicsBody; node: TransformNode } {
    const node = new TransformNode(`propcol-${key}`, this.scene);
    node.position.set(p.x, p.y, p.z);
    node.rotationQuaternion = Quaternion.FromEulerAngles(0, p.rot, 0);
    const body = new PhysicsBody(node, PhysicsMotionType.STATIC, false, this.scene);
    const e = PROP_EXTENTS[p.kind];
    const shape = new PhysicsShapeBox(
      new Vector3(0, e[1] / 2, 0),
      Quaternion.Identity(),
      new Vector3(Math.max(e[0], 0.3), e[1], Math.max(e[2], 0.3)),
      this.scene,
    );
    shape.filterMembershipMask = GROUP.PROP;
    body.shape = shape;
    return { body, node };
  }

  private removeKey(key: string, c: { body: PhysicsBody; node: TransformNode }): void {
    c.body.shape?.dispose();
    c.body.dispose();
    c.node.dispose();
    this.active.delete(key);
  }

  dispose(): void {
    for (const [k, c] of this.active) this.removeKey(k, c);
  }
}
