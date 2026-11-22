import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { PhysicsBody } from '@babylonjs/core/Physics/v2/physicsBody';
import { PhysicsShapeBox } from '@babylonjs/core/Physics/v2/physicsShape';
import { PhysicsMotionType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Scene } from '@babylonjs/core/scene';
import { PropKind } from '@kandern/world-format';
import type { PhysicsBudget } from '../engine/physics/budget/index.ts';
import { DEBRIS_COLLIDES, GROUP } from '../vehicles/physics/collisionGroups.ts';
import { PROP_EXTENTS, buildDebrisMesh } from './models/index.ts';
import type { WorldPropRef } from './PropLayer.ts';
import { PROP_RULES, launchVelocity } from './triggers.ts';

const MASS: Record<PropKind, number> = {
  [PropKind.Bush]: 3,
  [PropKind.Bin]: 8,
  [PropKind.Fence]: 6,
  [PropKind.Sign]: 6,
  [PropKind.Lamp]: 60,
  [PropKind.Bench]: 25,
};

/** Dynamischer Körper mit Box-Shape (Mitte auf halber Höhe über dem Fußpunkt). */
function dynamicBody(
  scene: Scene,
  mesh: Mesh,
  ext: [number, number, number],
  mass: number,
  group: number,
): PhysicsBody {
  const body = new PhysicsBody(mesh, PhysicsMotionType.DYNAMIC, false, scene);
  const shape = new PhysicsShapeBox(new Vector3(0, ext[1] / 2, 0), Quaternion.Identity(), new Vector3(...ext), scene);
  shape.filterMembershipMask = group;
  shape.filterCollideMask = group === GROUP.DEBRIS ? DEBRIS_COLLIDES : 0xffffffff;
  shape.material = { friction: 0.7, restitution: 0.25 };
  body.shape = shape;
  body.setMassProperties({ mass, centerOfMass: new Vector3(0, ext[1] * (group === GROUP.PROP ? 0.4 : 0.5), 0) });
  return body;
}

export interface SpawnContext {
  scene: Scene;
  budget: PhysicsBudget;
  bases: Mesh[];
  debrisMaterial: StandardMaterial;
}

/** Mülleimer/Bank fliegen weg, Laterne kippt: Ersatzkörper mit dem Grundmodell. */
export function spawnReplacement(ctx: SpawnContext, p: WorldPropRef, vx: number, vz: number): void {
  const mesh = ctx.bases[p.kind].clone(`prop-free-${p.kind}`, null, true, false) as Mesh;
  mesh.setEnabled(true);
  mesh.position.set(p.x, p.y, p.z);
  mesh.rotationQuaternion = Quaternion.FromEulerAngles(0, p.rot, 0);
  mesh.scaling.setAll(p.scale);
  mesh.computeWorldMatrix(true);
  const ext = PROP_EXTENTS[p.kind];
  const body = dynamicBody(
    ctx.scene,
    mesh,
    [ext[0] * p.scale, ext[1] * p.scale, ext[2] * p.scale],
    MASS[p.kind],
    GROUP.PROP,
  );
  const l = launchVelocity(vx, vz, p.kind);
  if (PROP_RULES[p.kind].reaction === 'topple') {
    // Laterne knickt um: wenig Flug, Drehung um die Achse quer zur Fahrtrichtung
    const speed = Math.hypot(vx, vz) || 1;
    body.setLinearVelocity(new Vector3(vx * 0.15, 0.5, vz * 0.15));
    body.setAngularVelocity(new Vector3((vz / speed) * 2.2, 0, (-vx / speed) * 2.2));
  } else {
    body.setLinearVelocity(new Vector3(l.vx, l.vy, l.vz));
    body.setAngularVelocity(
      new Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 6),
    );
  }
  ctx.budget.register('prop', {
    body,
    node: mesh,
    dispose: () => {
      body.shape?.dispose();
      body.dispose();
      mesh.dispose();
    },
    freeze: () => body.setMotionType(PhysicsMotionType.STATIC),
  });
}

/** Busch/Zaun/Schild zerbricht in 3–8 vorgefertigte Teile. */
export function spawnDebris(ctx: SpawnContext, p: WorldPropRef, vx: number, vz: number): void {
  const n = PROP_RULES[p.kind].pieces;
  const ext = PROP_EXTENTS[p.kind];
  const l = launchVelocity(vx, vz, p.kind);
  for (let i = 0; i < n; i++) {
    const size = 0.2 + Math.random() * 0.25;
    const mesh = buildDebrisMesh(ctx.scene, p.kind, size, ctx.debrisMaterial);
    const a = (i / n) * Math.PI * 2;
    mesh.position.set(
      p.x + Math.cos(a) * ext[0] * 0.3,
      p.y + ext[1] * (0.3 + Math.random() * 0.5),
      p.z + Math.sin(a) * ext[2] * 0.3 + Math.sin(a) * 0.2,
    );
    mesh.rotationQuaternion = Quaternion.FromEulerAngles(Math.random() * 3, Math.random() * 3, 0);
    const body = dynamicBody(ctx.scene, mesh, [size, size * 0.6, size * 0.8], 1.5, GROUP.DEBRIS);
    body.setLinearVelocity(
      new Vector3(
        l.vx * (0.6 + Math.random() * 0.6) + Math.cos(a) * 2,
        l.vy + Math.random() * 2,
        l.vz * (0.6 + Math.random() * 0.6) + Math.sin(a) * 2,
      ),
    );
    ctx.budget.register('debris', {
      body,
      node: mesh,
      dispose: () => {
        body.shape?.dispose();
        body.dispose();
        mesh.dispose();
      },
    });
  }
}
