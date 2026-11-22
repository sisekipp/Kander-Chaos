import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';

export interface Figure {
  root: TransformNode;
  meshes: Mesh[];
  setVisible(v: boolean): void;
  dispose(): void;
}

/** Platzhalter-Spielfigur (Kapsel + Kopf + Blob-Schatten). */
export function createFigure(scene: Scene): Figure {
  const root = new TransformNode('player', scene);
  const materials: StandardMaterial[] = [];
  const mat = (name: string, c: Color3, alpha = 1) => {
    const m = new StandardMaterial(name, scene);
    m.diffuseColor = c;
    m.specularColor = Color3.Black();
    m.alpha = alpha;
    materials.push(m);
    return m;
  };
  const body = CreateCapsule('player-body', { height: 1.75, radius: 0.33, tessellation: 10 }, scene);
  body.position.y = 0.875;
  body.material = mat('player-body', new Color3(0.95, 0.45, 0.2));
  const head = CreateSphere('player-head', { diameter: 0.42, segments: 8 }, scene);
  head.position.set(0, 1.62, 0.06);
  head.material = mat('player-head', new Color3(0.98, 0.82, 0.66));
  const shadow = CreateDisc('player-shadow', { radius: 0.5, tessellation: 16 }, scene);
  shadow.rotation.x = Math.PI / 2;
  shadow.position.y = 0.05;
  shadow.material = mat('player-shadow', Color3.Black(), 0.35); // Blob-Schatten (Qualität "Niedrig")
  const meshes = [body, head, shadow];
  for (const m of meshes) {
    m.parent = root;
    m.isPickable = false;
  }
  return {
    root,
    meshes,
    setVisible: (v) => root.setEnabled(v),
    dispose: () => {
      for (const m of meshes) m.dispose();
      for (const m of materials) m.dispose();
      root.dispose();
    },
  };
}
