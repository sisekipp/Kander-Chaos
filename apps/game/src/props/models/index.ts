import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateIcoSphere } from '@babylonjs/core/Meshes/Builders/icoSphereBuilder';
import { PropKind } from '@kandern/world-format';
import type { Scene } from '@babylonjs/core/scene';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { PartKit, createVertexColorMaterial, type RGB } from '../../engine/procedural/PartKit.ts';
import { Mesh as BabylonMesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { getModels } from '../../assets/ModelRegistry.ts';
import { SHAPE_KIND, SHAPE_MODELS, type PropShape } from './shapes.ts';

/** Kollisions-Ausdehnung (Breite, Höhe, Tiefe) je Art für Ersatzkörper; Ursprung des Modells = Fußpunkt. */
export const PROP_EXTENTS: Record<PropKind, [number, number, number]> = {
  [PropKind.Bush]: [1.4, 1.1, 1.4],
  [PropKind.Bin]: [0.5, 0.95, 0.5],
  [PropKind.Fence]: [0.12, 1.0, 2.5], // lang entlang z (= Richtung der Zaunlinie)
  [PropKind.Sign]: [0.6, 2.4, 0.12],
  [PropKind.Lamp]: [0.3, 4.6, 0.3],
  [PropKind.Bench]: [1.7, 0.85, 0.6],
  [PropKind.PostBox]: [0.45, 1.2, 0.35],
  [PropKind.Hydrant]: [0.35, 0.9, 0.35],
  [PropKind.Bollard]: [0.2, 0.9, 0.2],
  [PropKind.BikeRack]: [0.06, 0.85, 0.8], // Bügel entlang z
  [PropKind.AdColumn]: [1.2, 3.2, 1.2],
  [PropKind.Planter]: [1.0, 0.7, 0.6],
};

/** Farben der Trümmerteile je Art (passend zu den Hauptfarben der Modelle). */
export const DEBRIS_COLORS: Record<PropKind, RGB> = {
  [PropKind.Bush]: [0.3, 0.52, 0.22],
  [PropKind.Bin]: [0.2, 0.34, 0.26],
  [PropKind.Fence]: [0.7, 0.52, 0.32],
  [PropKind.Sign]: [0.42, 0.44, 0.46],
  [PropKind.Lamp]: [0.42, 0.44, 0.46],
  [PropKind.Bench]: [0.58, 0.4, 0.24],
  [PropKind.PostBox]: [0.95, 0.78, 0.15],
  [PropKind.Hydrant]: [0.8, 0.15, 0.12],
  [PropKind.Bollard]: [0.42, 0.44, 0.46],
  [PropKind.BikeRack]: [0.6, 0.62, 0.64],
  [PropKind.AdColumn]: [0.24, 0.38, 0.3],
  [PropKind.Planter]: [0.68, 0.67, 0.64],
};

const GREEN: RGB = [0.33, 0.6, 0.26];
const DARK_GREEN: RGB = [0.2, 0.42, 0.3];
const WOOD: RGB = [0.62, 0.45, 0.3];
const WHITE: RGB = [0.94, 0.94, 0.92];
const GREY: RGB = [0.3, 0.32, 0.35];
const RED: RGB = [0.85, 0.2, 0.18];
const LAMP: RGB = [1, 0.92, 0.6];

/** Baut das Grundmodell einer Art (ein zusammengeführtes Mesh mit Vertex-Farben, Fußpunkt = Ursprung). */
export function buildPropMesh(scene: Scene, kind: PropKind): Mesh {
  const kit = new PartKit(scene, `prop-${kind}`);
  const root = new TransformNode('tmp', scene);
  switch (kind) {
    case PropKind.Bush: {
      const s = CreateIcoSphere('b', { radius: 0.7, subdivisions: 1, flat: true }, scene);
      s.position.y = 0.55;
      s.scaling.y = 0.8;
      const col = new Float32Array(s.getTotalVertices() * 4);
      for (let i = 0; i < col.length; i += 4) col.set([GREEN[0], GREEN[1], GREEN[2], 1], i);
      s.setVerticesData('color', col);
      kit.adopt(s);
      break;
    }
    case PropKind.Bin:
      kit.cylinder(0.5, 0.85, [0, 0.425, 0], DARK_GREEN, 'y');
      kit.cylinder(0.56, 0.08, [0, 0.89, 0], GREY, 'y');
      break;
    case PropKind.Fence:
      // entlang z (= Richtung der Zaunlinie)
      for (const z of [-1.2, 1.2]) kit.box(0.1, 1.0, 0.1, [0, 0.5, z], WOOD);
      for (const y of [0.3, 0.6, 0.9]) kit.box(0.04, 0.1, 2.5, [0, y, 0], WHITE);
      break;
    case PropKind.Sign:
      kit.cylinder(0.07, 2.2, [0, 1.1, 0], GREY, 'y');
      kit.cylinder(0.6, 0.04, [0, 2.1, 0], RED, 'z', { tessellation: 16 });
      kit.cylinder(0.46, 0.05, [0, 2.1, 0.01], WHITE, 'z', { tessellation: 16 });
      break;
    case PropKind.Lamp:
      kit.cylinder(0.12, 4.4, [0, 2.2, 0], GREY, 'y');
      kit.box(0.5, 0.12, 0.25, [0, 4.4, 0.15], GREY);
      kit.box(0.36, 0.06, 0.18, [0, 4.33, 0.15], LAMP);
      break;
    case PropKind.Bench:
      kit.box(1.6, 0.06, 0.45, [0, 0.45, 0], WOOD);
      kit.box(1.6, 0.35, 0.05, [0, 0.72, -0.22], WOOD);
      for (const x of [-0.7, 0.7]) kit.box(0.06, 0.45, 0.4, [x, 0.22, 0], GREY);
      break;
    // Rückfall-Modelle der Erweiterung (nur ohne Registry-Modell sichtbar)
    case PropKind.PostBox:
      kit.box(0.08, 0.7, 0.08, [0, 0.35, 0], GREY);
      kit.box(0.45, 0.5, 0.35, [0, 0.95, 0], [0.95, 0.78, 0.15]);
      break;
    case PropKind.Hydrant:
      kit.cylinder(0.3, 0.85, [0, 0.42, 0], RED, 'y');
      break;
    case PropKind.Bollard:
      kit.cylinder(0.18, 0.9, [0, 0.45, 0], GREY, 'y');
      break;
    case PropKind.BikeRack:
      kit.box(0.05, 0.8, 0.05, [0, 0.4, -0.38], GREY);
      kit.box(0.05, 0.8, 0.05, [0, 0.4, 0.38], GREY);
      kit.box(0.05, 0.05, 0.8, [0, 0.8, 0], GREY);
      break;
    case PropKind.AdColumn:
      kit.cylinder(1.1, 3.0, [0, 1.5, 0], [0.24, 0.38, 0.3], 'y');
      break;
    case PropKind.Planter:
      kit.box(1.0, 0.5, 0.6, [0, 0.25, 0], [0.68, 0.67, 0.64]);
      kit.box(0.9, 0.2, 0.5, [0, 0.6, 0], GREEN);
      break;
  }
  const mesh = kit.mergeFixed(`prop-base-${kind}`, root);
  mesh.parent = null;
  root.dispose();
  mesh.setEnabled(false);
  return mesh;
}

/** Ein kleines Trümmerteil (Box) in der Farbe der Art; Material wird geteilt. */
export function buildDebrisMesh(scene: Scene, kind: PropKind, size: number, material: StandardMaterial): Mesh {
  const kit = new PartKit(scene, `debris-${kind}`, material);
  return kit.box(size, size * 0.6, size * 0.8, [0, 0, 0], DEBRIS_COLORS[kind], { fixed: false });
}

/**
 * Grundmodell einer Form aus der Modell-Registry: alle Teil-Meshes zu einem Mesh mit Vertex-Farben
 * zusammengeführt (ein Draw Call je Form und Kachel). Ohne Registry-Modell: prozedurales Modell der Art.
 */
export function buildShapeMesh(scene: Scene, shape: PropShape, material?: StandardMaterial): Mesh {
  const registry = getModels();
  const id = SHAPE_MODELS[shape];
  if (!registry || !registry.ids.includes(id)) return buildPropMesh(scene, SHAPE_KIND[shape]);
  const parts = registry.instanceTemplates(id);
  const merged = new VertexData();
  merged.positions = [];
  merged.normals = [];
  merged.colors = [];
  merged.indices = [];
  for (const p of parts) {
    const base = merged.positions.length / 3;
    const vd = p.vertexData;
    const n = (vd.positions?.length ?? 0) / 3;
    (merged.positions as number[]).push(...(vd.positions ?? []));
    (merged.normals as number[]).push(...(vd.normals ?? []));
    (merged.colors as number[]).push(...(vd.colors ?? Array.from({ length: n * 4 }, () => 1)));
    (merged.indices as number[]).push(...Array.from(vd.indices ?? [], (i) => i + base));
  }
  const mesh = new BabylonMesh(`prop-shape-${id}`, scene);
  merged.applyToMesh(mesh, false);
  mesh.material = material ?? createVertexColorMaterial(scene, `prop-mat-${id}`);
  mesh.isPickable = false;
  mesh.setEnabled(false);
  return mesh;
}
