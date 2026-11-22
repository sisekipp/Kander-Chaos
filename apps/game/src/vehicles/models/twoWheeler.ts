import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { VehicleKind } from '@kandern/world-format';
import type { VehicleSpec } from '../specs.ts';
import { CHROME, DARK, LIGHT, PartKit, RIM, TIRE } from '../../engine/procedural/PartKit.ts';
import type { RGB } from './palette.ts';
import type { VehicleModel } from './types.ts';

/** Fahrrad und Motorrad aus wenigen Grundkörpern; Vorderbau als lenkbarer Knoten. */
export function buildTwoWheeler(scene: Scene, spec: VehicleSpec, paint: RGB, name: string): VehicleModel {
  const kit = new PartKit(scene, name);
  const root = new TransformNode(name, scene);
  const moto = spec.kind === VehicleKind.Motorbike;
  const [front, rear] = spec.wheels;
  const axleY = (wh: typeof front) => wh.y - spec.suspension.rest + wh.radius;
  const fy = axleY(front),
    ry = axleY(rear);
  if (moto) {
    kit.box(0.42, 0.42, 1.0, [0, ry + 0.32, 0], paint); // Tank/Rumpf
    kit.box(0.36, 0.12, 0.62, [0, ry + 0.56, -0.38], DARK); // Sitz
    kit.box(0.3, 0.3, 0.45, [0, ry + 0.08, -0.05], DARK); // Motor
    kit.cylinder(0.1, 0.7, [0.18, ry + 0.05, -0.45], CHROME, 'z'); // Auspuff
  } else {
    kit.cylinder(0.05, 1.05, [0, ry + 0.35, 0], paint, 'z'); // Oberrohr
    kit.box(0.05, 0.62, 0.05, [0, ry + 0.2, -0.2], paint); // Sitzrohr
    kit.box(0.24, 0.06, 0.26, [0, ry + 0.55, -0.24], DARK); // Sattel
    kit.cylinder(0.05, 0.75, [0, ry + 0.1, 0.12], paint, 'z'); // Unterrohr
  }
  const body = kit.mergeFixed(`${name}-body`, root);
  // Vorderbau: Gabel + Lenker + Vorderrad drehen gemeinsam
  const steerNode = new TransformNode(`${name}-steer`, scene);
  steerNode.parent = root;
  steerNode.position.set(0, 0, front.z);
  const fork = kit.box(0.08, 0.75, 0.08, [0, fy + 0.35, 0], moto ? CHROME : paint, { fixed: false });
  const bar = kit.cylinder(0.06, moto ? 0.75 : 0.62, [0, fy + 0.75, -0.05], DARK, 'x', { fixed: false });
  fork.parent = steerNode;
  bar.parent = steerNode;
  const detachable = [bar];
  if (moto) {
    const lamp = kit.box(0.2, 0.18, 0.12, [0, fy + 0.6, 0.08], LIGHT, { fixed: false });
    lamp.parent = steerNode;
    detachable.push(lamp);
  }
  const mudguard = kit.box(0.14, 0.04, 0.5, [0, ry + rear.radius + 0.05, rear.z - 0.05], paint, { fixed: false });
  mudguard.parent = root;
  detachable.push(mudguard);
  const width = moto ? 0.16 : 0.06;
  const wFront = kit.wheel(front.radius, width, [0, fy, 0], TIRE, RIM, steerNode);
  const wRear = kit.wheel(rear.radius, width, [0, ry, rear.z], TIRE, RIM, root);
  return {
    root,
    body,
    wheels: [wFront, wRear],
    steerNode,
    detachable,
    material: kit.material,
    dispose: () => {
      root.dispose(false, false);
      kit.material.dispose();
    },
  };
}
