import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateIcoSphere } from '@babylonjs/core/Meshes/Builders/icoSphereBuilder';
import type { Scene } from '@babylonjs/core/scene';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color4 } from '@babylonjs/core/Maths/math.color';

function colorize(mesh: Mesh, r: number, g: number, b: number): Mesh {
  const n = mesh.getTotalVertices();
  const c = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) c.set([r, g, b, 1], i * 4);
  mesh.setVerticesData('color', c);
  return mesh;
}

/**
 * Low-Poly-Baumformen (Laub, Nadel, Obst) als Basis für Thin Instances.
 * Stamm- und Kronenfarben sind als Vertex-Farben eingebacken (Material weiß).
 */
export function createTreeBases(scene: Scene, materials: StandardMaterial[]): Mesh[] {
  const trunkCol = new Color4(0.42, 0.3, 0.2, 1);
  const mk = (parts: Mesh[], name: string, mat: StandardMaterial) => {
    const m = Mesh.MergeMeshes(parts, true, true)!;
    m.name = name;
    m.material = mat;
    m.isPickable = false;
    m.setEnabled(false);
    return m;
  };
  const deciduous = mk(
    [
      colorize(
        CreateCylinder('t', { height: 3, diameterTop: 0.35, diameterBottom: 0.5, tessellation: 5 }, scene),
        trunkCol.r,
        trunkCol.g,
        trunkCol.b,
      ),
      colorize(CreateIcoSphere('c', { radius: 2.8, subdivisions: 1, flat: true }, scene), 0.36, 0.58, 0.27),
    ].map((m, i) => {
      if (i === 0) m.position.y = 1.5;
      else {
        m.position.y = 5;
        m.scaling.y = 0.9;
      }
      return m;
    }),
    'tree-deciduous',
    materials[0],
  );
  const conifer = mk(
    [
      colorize(
        CreateCylinder('t', { height: 2, diameter: 0.4, tessellation: 5 }, scene),
        trunkCol.r,
        trunkCol.g,
        trunkCol.b,
      ),
      colorize(
        CreateCylinder('c1', { height: 6, diameterTop: 0, diameterBottom: 3.6, tessellation: 6 }, scene),
        0.2,
        0.42,
        0.25,
      ),
      colorize(
        CreateCylinder('c2', { height: 4, diameterTop: 0, diameterBottom: 2.6, tessellation: 6 }, scene),
        0.18,
        0.38,
        0.23,
      ),
    ].map((m, i) => {
      m.position.y = i === 0 ? 1 : i === 1 ? 4.5 : 7.5;
      return m;
    }),
    'tree-conifer',
    materials[1],
  );
  const fruit = mk(
    [
      colorize(
        CreateCylinder('t', { height: 1.8, diameterTop: 0.25, diameterBottom: 0.35, tessellation: 5 }, scene),
        trunkCol.r,
        trunkCol.g,
        trunkCol.b,
      ),
      colorize(CreateIcoSphere('c', { radius: 1.9, subdivisions: 1, flat: true }, scene), 0.47, 0.66, 0.3),
    ].map((m, i) => {
      if (i === 0) m.position.y = 0.9;
      else {
        m.position.y = 2.9;
        m.scaling.y = 0.8;
      }
      return m;
    }),
    'tree-fruit',
    materials[2],
  );
  return [deciduous, conifer, fruit];
}
