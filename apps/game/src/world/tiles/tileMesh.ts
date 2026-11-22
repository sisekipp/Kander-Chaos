import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import type { Material } from '@babylonjs/core/Materials/material';
import type { Scene } from '@babylonjs/core/scene';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { GeometryBuffers } from '../gen/GeoBuilder.ts';

/** Erzeugt ein Mesh aus Worker-Geometriepuffern (Kachel-lokal unter `parent`). */
export function meshFromBuffers(
  scene: Scene,
  name: string,
  g: GeometryBuffers,
  material: Material,
  parent: TransformNode | null,
): Mesh {
  const mesh = new Mesh(name, scene, parent);
  const vd = new VertexData();
  vd.positions = g.positions;
  vd.normals = g.normals;
  vd.colors = g.colors;
  vd.indices = g.indices;
  if (g.uvs) vd.uvs = g.uvs;
  if (g.uvs2) vd.uvs2 = g.uvs2;
  vd.applyToMesh(mesh, false);
  mesh.material = material;
  mesh.isPickable = false;
  mesh.doNotSyncBoundingInfo = true;
  return mesh;
}
