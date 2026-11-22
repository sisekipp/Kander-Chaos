import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Scene } from '@babylonjs/core/scene';

/**
 * Statisches Hügel-Panorama hinter der Sichtgrenze: ein Ring mit gezackter Oberkante
 * (Schwarzwald/Markgräflerland-Silhouette, stilisiert), der der Kamera folgt.
 * Nebelfrei, Farbe knapp unter der Nebelfarbe -> keine harte Weltkante am Horizont.
 */
export function createPanorama(
  scene: Scene,
  fogColor: Color3,
  radius = 2000,
): { mesh: Mesh; follow(x: number, z: number, y: number): void; dispose(): void } {
  const seg = 160;
  const pos: number[] = [],
    col: number[] = [],
    idx: number[] = [];
  const far = Color3.Lerp(fogColor, new Color3(0.36, 0.5, 0.42), 0.32);
  const near = Color3.Lerp(fogColor, new Color3(0.3, 0.44, 0.36), 0.42);
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    // Schwarzwald im Osten/Nordosten höher (Blauen), Rheinebene im Westen flach
    const east = Math.max(0, Math.cos(a - 0.4));
    const h = 40 + 140 * east + 35 * Math.sin(a * 7.3) * Math.sin(a * 2.1) + 18 * Math.sin(a * 17.7);
    const x = Math.cos(a) * radius,
      z = Math.sin(a) * radius;
    pos.push(x, -120, z, x, Math.max(20, h), z);
    col.push(near.r, near.g, near.b, 1, far.r, far.g, far.b, 1);
    if (i < seg) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const mesh = new Mesh('panorama', scene);
  const vd = new VertexData();
  vd.positions = pos;
  vd.colors = col;
  vd.indices = idx;
  vd.applyToMesh(mesh);
  const mat = new StandardMaterial('panorama', scene);
  mat.disableLighting = true;
  mat.emissiveColor = Color3.White();
  mat.fogEnabled = false;
  mat.backFaceCulling = false;
  mesh.material = mat;
  mesh.isPickable = false;
  mesh.infiniteDistance = false;
  mesh.alwaysSelectAsActiveMesh = true;
  return {
    mesh,
    follow(x, z, y) {
      mesh.position.set(x, y, z);
    },
    dispose() {
      mesh.dispose();
      mat.dispose();
    },
  };
}
