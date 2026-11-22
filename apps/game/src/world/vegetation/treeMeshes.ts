import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateIcoSphere } from '@babylonjs/core/Meshes/Builders/icoSphereBuilder';
import type { Scene } from '@babylonjs/core/scene';
import type { Material } from '@babylonjs/core/Materials/material';

type RGB = [number, number, number];

const TRUNK: RGB = [0.42, 0.3, 0.2];

/** Einfarbig (Stamm). */
function colorize(mesh: Mesh, c: RGB): Mesh {
  const n = mesh.getTotalVertices();
  const col = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) col.set([c[0], c[1], c[2], 1], i * 4);
  mesh.setVerticesData('color', col);
  return mesh;
}

/** Zwei Grüntöne: unten `low`, oben `high` (Krone oben heller, wirkt wie Licht von oben). */
function gradient(mesh: Mesh, low: RGB, high: RGB): Mesh {
  const pos = mesh.getVerticesData('position')!;
  let minY = Infinity,
    maxY = -Infinity;
  for (let i = 1; i < pos.length; i += 3) {
    minY = Math.min(minY, pos[i]);
    maxY = Math.max(maxY, pos[i]);
  }
  const n = pos.length / 3;
  const col = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const t = (pos[i * 3 + 1] - minY) / Math.max(1e-6, maxY - minY);
    col.set(
      [low[0] + (high[0] - low[0]) * t, low[1] + (high[1] - low[1]) * t, low[2] + (high[2] - low[2]) * t, 1],
      i * 4,
    );
  }
  mesh.setVerticesData('color', col);
  return mesh;
}

function place(m: Mesh, y: number, sy = 1): Mesh {
  m.position.y = y;
  m.scaling.y = sy;
  return m;
}

/**
 * Fünf Low-Poly-Baumformen als Basis für Thin Instances (Reihenfolge = TreeSpecies):
 * runder Laubbaum, Nadelbaum, Obstbaum, hoher Laubbaum (Pappel), Busch.
 * Farben als Vertex-Farben; die Tönung je Baum kommt aus dem Instanz-Farbpuffer.
 */
export function createTreeBases(scene: Scene, material: Material): Mesh[] {
  const mk = (parts: Mesh[], name: string) => {
    const m = Mesh.MergeMeshes(parts, true, true)!;
    m.name = name;
    m.material = material;
    m.isPickable = false;
    m.setEnabled(false);
    return m;
  };
  const trunk = (h: number, d: number) =>
    place(
      colorize(
        CreateCylinder('t', { height: h, diameterTop: d * 0.7, diameterBottom: d, tessellation: 5 }, scene),
        TRUNK,
      ),
      h / 2,
    );
  const crown = (r: number, y: number, sy: number, low: RGB, high: RGB, sub = 1) =>
    place(gradient(CreateIcoSphere('c', { radius: r, subdivisions: sub, flat: true }, scene), low, high), y, sy);
  const cone = (h: number, d: number, y: number, low: RGB, high: RGB) =>
    place(
      gradient(
        CreateCylinder('k', { height: h, diameterTop: 0, diameterBottom: d, tessellation: 6 }, scene),
        low,
        high,
      ),
      y,
    );

  const deciduous = mk(
    [
      trunk(3, 0.5),
      crown(2.8, 5, 0.9, [0.27, 0.45, 0.2], [0.42, 0.62, 0.28]),
      crown(1.7, 6.6, 0.85, [0.33, 0.52, 0.23], [0.46, 0.66, 0.3]),
    ],
    'tree-deciduous',
  );
  const conifer = mk(
    [
      trunk(2, 0.4),
      cone(6, 3.6, 4.5, [0.14, 0.32, 0.2], [0.22, 0.43, 0.27]),
      cone(4, 2.6, 7.5, [0.17, 0.37, 0.23], [0.26, 0.48, 0.3]),
    ],
    'tree-conifer',
  );
  const fruit = mk([trunk(1.8, 0.35), crown(1.9, 2.9, 0.8, [0.36, 0.53, 0.22], [0.5, 0.68, 0.3])], 'tree-fruit');
  const tall = mk([trunk(3.5, 0.45), crown(1.5, 7.2, 2.6, [0.25, 0.42, 0.19], [0.4, 0.6, 0.27])], 'tree-tall');
  const bush = mk([crown(1.1, 0.7, 0.75, [0.25, 0.42, 0.18], [0.38, 0.58, 0.25])], 'tree-bush');
  return [deciduous, conifer, fruit, tall, bush];
}
