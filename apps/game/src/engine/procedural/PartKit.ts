import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
export type RGB = [number, number, number];

/** Baukasten für prozedurale Fahrzeuge: Teile mit Vertex-Farben, ein Material je Fahrzeug. */
export class PartKit {
  readonly material: StandardMaterial;
  private readonly fixed: Mesh[] = [];

  /** `shared`: vorhandenes Material wiederverwenden (z. B. für viele Trümmerteile). */
  constructor(
    private readonly scene: Scene,
    name: string,
    shared?: StandardMaterial,
  ) {
    this.material = shared ?? createVertexColorMaterial(scene, `${name}-mat`);
  }

  private colorize(m: Mesh, c: RGB): Mesh {
    const n = m.getTotalVertices();
    const col = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) col.set([c[0], c[1], c[2], 1], i * 4);
    m.setVerticesData('color', col);
    m.material = this.material;
    m.isPickable = false;
    return m;
  }

  box(
    w: number,
    h: number,
    d: number,
    pos: [number, number, number],
    c: RGB,
    opts: { fixed?: boolean; rotX?: number } = {},
  ): Mesh {
    const m = this.colorize(CreateBox('part', { width: w, height: h, depth: d }, this.scene), c);
    m.position.set(...pos);
    if (opts.rotX) m.rotation.x = opts.rotX;
    if (opts.fixed !== false) this.fixed.push(m);
    return m;
  }

  cylinder(
    diameter: number,
    height: number,
    pos: [number, number, number],
    c: RGB,
    axis: 'x' | 'y' | 'z',
    opts: { fixed?: boolean; tessellation?: number } = {},
  ): Mesh {
    const m = this.colorize(
      CreateCylinder('part', { diameter, height, tessellation: opts.tessellation ?? 10 }, this.scene),
      c,
    );
    m.position.set(...pos);
    if (axis === 'x') m.rotation.z = Math.PI / 2;
    if (axis === 'z') m.rotation.x = Math.PI / 2;
    if (opts.fixed !== false) this.fixed.push(m);
    return m;
  }

  /** Rad als eigener Knoten (dreht sich beim Fahren, Vorderräder lenken). */
  wheel(
    radius: number,
    width: number,
    pos: [number, number, number],
    tire: RGB,
    rim: RGB,
    parent: TransformNode,
  ): TransformNode {
    const node = new TransformNode('wheel', this.scene);
    node.parent = parent;
    node.position.set(...pos);
    const t = this.cylinder(radius * 2, width, [0, 0, 0], tire, 'x', { fixed: false, tessellation: 12 });
    const r = this.cylinder(radius * 1.1, width * 1.05, [0, 0, 0], rim, 'x', { fixed: false, tessellation: 8 });
    t.parent = node;
    r.parent = node;
    return node;
  }

  /** Fremd erzeugtes Mesh (bereits mit Vertex-Farben) als festes Teil übernehmen. */
  adopt(m: Mesh): Mesh {
    m.material = this.material;
    m.isPickable = false;
    this.fixed.push(m);
    return m;
  }

  /** Alle festen Teile zu einem Mesh zusammenführen (ein Draw Call für die Karosserie). */
  mergeFixed(name: string, parent: TransformNode): Mesh {
    const merged = Mesh.MergeMeshes(this.fixed, true, true)!;
    merged.name = name;
    merged.parent = parent;
    merged.material = this.material;
    merged.isPickable = false;
    return merged;
  }
}

/** Weißes Material, das die Vertex-Farben zeigt. */
export function createVertexColorMaterial(scene: Scene, name: string): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = Color3.White();
  m.specularColor = new Color3(0.15, 0.15, 0.15);
  return m;
}

export const TIRE: RGB = [0.12, 0.12, 0.13];
export const RIM: RGB = [0.78, 0.78, 0.8];
export const GLASS: RGB = [0.35, 0.55, 0.68];
export const CHROME: RGB = [0.82, 0.83, 0.85];
export const DARK: RGB = [0.18, 0.18, 0.2];
export const LIGHT: RGB = [1, 0.96, 0.78];
