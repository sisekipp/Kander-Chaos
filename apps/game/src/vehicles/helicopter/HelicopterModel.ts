import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Scene } from '@babylonjs/core/scene';
import type { ModelRegistry } from '../../assets/ModelRegistry.ts';
import type { RGB } from '../../assets/palette.ts';
import { bakePaint } from '../models/registryModel.ts';

export interface HelicopterModel {
  /** Ursprung = Boden unter der Rumpfmitte (Kufen-Unterkante), vorne = +z. */
  root: TransformNode;
  rotorMain: TransformNode;
  rotorTail: TransformNode;
  dispose(): void;
}

/** Zivile Lackfarben (Spec helicopter: keine Polizei-/Rettungsbeschriftung). */
export const HELI_PAINTS: RGB[] = [
  [0.82, 0.14, 0.1],
  [0.16, 0.36, 0.72],
  [0.94, 0.94, 0.92],
  [0.96, 0.78, 0.15],
];

/**
 * Hubschrauber aus der Modell-Registry: Lack eingebacken, Rotoren an eigenen Drehknoten (Mitte aus dem Manifest,
 * dort als „Räder“ geführt). glTF ist rechtshändig, Babylon spiegelt x: Modellpunkt (x, y, z) -> (−x, y, z).
 */
export function buildHelicopterModel(
  scene: Scene,
  registry: ModelRegistry,
  material: StandardMaterial,
  paint: RGB,
  name: string,
): HelicopterModel {
  const entry = registry.entry('helicopter');
  const inst = registry.instantiate('helicopter', name);
  const root = new TransformNode(name, scene);
  for (const n of inst.rootNodes) n.parent = root;
  const meshes = root.getChildMeshes(false) as Mesh[];
  for (const m of meshes) {
    if (m.material?.name.endsWith('zone_paint')) bakePaint(m, paint);
    m.material = material;
    m.isPickable = false;
    m.hasVertexAlpha = false;
  }
  root.computeWorldMatrix(true);
  const pivot = (nodeName: string, i: number) => {
    const w = entry.vehicle!.wheels[i];
    const p = new TransformNode(`${name}-${nodeName}`, scene);
    p.parent = root;
    p.position.set(-w.x, w.y, w.z);
    p.computeWorldMatrix(true);
    const node = [root, ...root.getChildren(undefined, false)].find((n) => n.name.split(':').pop() === nodeName);
    if (node) (node as TransformNode).setParent(p);
    return p;
  };
  const rotorMain = pivot('rotor-main', 0);
  const rotorTail = pivot('rotor-tail', 1);
  return { root, rotorMain, rotorTail, dispose: () => root.dispose(false, false) };
}

/** Landeplatz-Platte aus der Registry (ein Mesh je Platz, wenige im Spiel). */
export function buildHelipad(
  scene: Scene,
  registry: ModelRegistry,
  material: StandardMaterial,
  name: string,
): TransformNode {
  const inst = registry.instantiate('helipad', name);
  const root = new TransformNode(name, scene);
  for (const n of inst.rootNodes) n.parent = root;
  for (const m of root.getChildMeshes(false) as Mesh[]) {
    m.material = material;
    m.isPickable = false;
    m.hasVertexAlpha = false;
  }
  return root;
}
