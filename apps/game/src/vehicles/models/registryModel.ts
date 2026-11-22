import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { ModelEntry } from '../../assets/manifest.ts';
import type { ModelRegistry } from '../../assets/ModelRegistry.ts';
import type { RGB } from '../../assets/palette.ts';
import type { VehicleSpec } from '../specs.ts';
import type { VehicleModel } from './types.ts';
import { physicsBox } from './fromManifest.ts';

/** Färbt die Lack-Zone dieser Kopie ein: Grauwerte der Zone × Lackfarbe in die (eigenen) Vertex-Farben. */
function bakePaint(mesh: Mesh, paint: RGB): void {
  mesh.makeGeometryUnique();
  const col = mesh.getVerticesData(VertexBuffer.ColorKind);
  if (!col) return;
  const out = new Float32Array(col.length);
  for (let i = 0; i < col.length; i += 4) {
    out[i] = col[i] * paint[0];
    out[i + 1] = col[i + 1] * paint[1];
    out[i + 2] = col[i + 2] * paint[2];
    out[i + 3] = 1;
  }
  mesh.setVerticesData(VertexBuffer.ColorKind, out);
}

/**
 * Fahrzeug aus der Modell-Registry als `VehicleModel`:
 * - `root` = Mitte des Kollisionskörpers; das geladene Modell hängt versetzt darunter
 * - je Rad ein eigener Drehknoten an der Radmitte (die Physik setzt Höhe, Drehung und Lenkung)
 * - Lack je Fahrzeug in die Vertex-Farben gebacken, ein gemeinsames Material (Schadensfärbung wie bisher)
 * - lösbare Teile = Meshes der `detach_*`-Knoten
 */
export function buildRegistryVehicle(
  scene: Scene,
  registry: ModelRegistry,
  entry: ModelEntry,
  spec: VehicleSpec,
  paint: RGB,
  name: string,
): VehicleModel {
  const info = entry.vehicle!;
  const center = physicsBox(info).center;
  const inst = registry.instantiate(entry.id, name);
  const root = new TransformNode(name, scene);
  const modelRoot = inst.rootNodes[0] as TransformNode;
  modelRoot.parent = root;
  // Modellkoordinaten -> Babylon spiegelt x; Karosseriemitte in den Ursprung von root legen
  modelRoot.position.set(center[0], -center[1], -center[2]);
  root.computeWorldMatrix(true);
  modelRoot.computeWorldMatrix(true);

  const material = new StandardMaterial(`${name}-mat`, scene);
  material.diffuseColor = Color3.White();
  material.specularColor = new Color3(0.15, 0.15, 0.15);
  const meshes = modelRoot.getChildMeshes(false) as Mesh[];
  const oldMaterials = new Set(meshes.map((m) => m.material).filter((m) => m !== null));
  let body: Mesh | null = null;
  const detachable: Mesh[] = [];
  for (const m of meshes) {
    if (m.material?.name.endsWith('zone_paint')) bakePaint(m, paint);
    m.material = material;
    m.isPickable = false;
    const nodeName = m.name.split(':').pop() ?? '';
    const parentName = m.parent?.name.split(':').pop() ?? '';
    if (nodeName.startsWith('detach_') || parentName.startsWith('detach_')) detachable.push(m);
    else if (!body && (nodeName.startsWith('body') || parentName.startsWith('body'))) body = m;
  }
  for (const mat of oldMaterials) mat?.dispose();

  // Räder: eigene Drehknoten an der Radmitte, Rad-Meshes darunter (Weltlage bleibt erhalten)
  const wheels = info.wheels.map((w, i) => {
    const pivot = new TransformNode(`${name}-wheel${i}`, scene);
    pivot.parent = root;
    const ws = spec.wheels[i];
    pivot.position.set(ws.x, w.y - center[1], ws.z);
    pivot.computeWorldMatrix(true);
    const node = [modelRoot, ...modelRoot.getChildren(undefined, false)].find(
      (n) => n.name.split(':').pop() === w.name,
    );
    if (node) (node as TransformNode).setParent(pivot);
    return pivot;
  });
  // Teile ohne eigenen Knoten unter root hängen (für das Abkoppeln im Schadensfall)
  for (const d of detachable) d.setParent(root);

  return {
    root,
    body: body ?? meshes[0],
    wheels,
    steerNode: null,
    detachable,
    material,
    dispose: () => {
      root.dispose(false, false);
      material.dispose();
    },
  };
}
