import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate';
import { PhysicsShapeType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import type { Scene } from '@babylonjs/core/scene';
import { enableHavok, releaseHavok } from '../physics/havok.ts';

/** Deterministischer Zufall (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SIZE = 250;
const terrainH = (x: number, z: number) =>
  4 * Math.sin(x * 0.02) * Math.cos(z * 0.017) + 2 * Math.sin(x * 0.05 + z * 0.03);

/**
 * Synthetische Stress-Szene für den Spike: eine 250-m-Kachel mit Gelände (2-m-Raster),
 * ca. 400 Gebäude (ein Mesh) und 2000 Bäume (Thin Instances). Entspricht grob der dichtesten
 * Kernstadt-Kachel und dient als Messlatte, bevor echte Daten existieren.
 */
export class StressScene {
  private readonly meshes: Mesh[] = [];
  private readonly aggregates: PhysicsAggregate[] = [];
  private readonly materials: StandardMaterial[] = [];
  readonly stats = { buildings: 0, trees: 0, terrainTris: 0 };
  private usesPhysics = false;

  constructor(private readonly scene: Scene) {}

  build(): void {
    const r = rng(1234);
    const off = -SIZE / 2;

    // Gelände
    const n = 126;
    const pos: number[] = [];
    const idx: number[] = [];
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = off + (i / (n - 1)) * SIZE;
        const z = off + (j / (n - 1)) * SIZE;
        pos.push(x, terrainH(x, z), z);
      }
    }
    for (let j = 0; j < n - 1; j++) {
      for (let i = 0; i < n - 1; i++) {
        const a = j * n + i;
        idx.push(a, a + 1, a + n, a + 1, a + n + 1, a + n);
      }
    }
    const normals: number[] = [];
    VertexData.ComputeNormals(pos, idx, normals);
    const vd = new VertexData();
    vd.positions = pos;
    vd.indices = idx;
    vd.normals = normals;
    const ground = new Mesh('stress-ground', this.scene);
    vd.applyToMesh(ground);
    ground.material = this.mat('ground', new Color3(0.45, 0.62, 0.3));
    ground.freezeWorldMatrix();
    this.meshes.push(ground);
    this.stats.terrainTris = idx.length / 3;

    // Gebäude: Boxen zu einem Mesh zusammenführen
    const parts: Mesh[] = [];
    for (let k = 0; k < 400; k++) {
      const w = 6 + r() * 10;
      const d = 6 + r() * 10;
      const h = 5 + r() * 9;
      const b = CreateBox('b', { width: w, depth: d, height: h }, this.scene);
      const x = off + 10 + r() * (SIZE - 20);
      const z = off + 10 + r() * (SIZE - 20);
      b.position.set(x, terrainH(x, z) + h / 2, z);
      b.rotation.y = r() * Math.PI;
      parts.push(b);
    }
    const houses = Mesh.MergeMeshes(parts, true, true)!;
    houses.name = 'stress-houses';
    houses.material = this.mat('houses', new Color3(0.93, 0.85, 0.7));
    houses.freezeWorldMatrix();
    this.meshes.push(houses);
    this.stats.buildings = 400;

    // Bäume: Thin Instances
    const tree = CreateCylinder('tree', { height: 8, diameterTop: 0, diameterBottom: 4, tessellation: 6 }, this.scene);
    tree.material = this.mat('tree', new Color3(0.2, 0.45, 0.22));
    const count = 2000;
    const matrices = new Float32Array(count * 16);
    const m = new Matrix();
    for (let k = 0; k < count; k++) {
      const x = off + r() * SIZE;
      const z = off + r() * SIZE;
      const s = 0.7 + r() * 0.6;
      Matrix.ComposeToRef(new Vector3(s, s, s), Quaternion.Identity(), new Vector3(x, terrainH(x, z) + 4 * s, z), m);
      m.copyToArray(matrices, k * 16);
    }
    tree.thinInstanceSetBuffer('matrix', matrices, 16, true);
    tree.freezeWorldMatrix();
    this.meshes.push(tree);
    this.stats.trees = count;
  }

  /** Physik-Stresstest: 50 Kugeln/Boxen fallen auf Gelände und Gebäude. Liefert WASM-Startzeit. */
  async dropPhysicsBodies(count = 50): Promise<{ wasmStartMs: number }> {
    const { wasmStartMs } = await enableHavok(this.scene);
    this.usesPhysics = true;
    const ground = this.meshes[0];
    const houses = this.meshes[1];
    this.aggregates.push(new PhysicsAggregate(ground, PhysicsShapeType.MESH, { mass: 0 }, this.scene));
    this.aggregates.push(new PhysicsAggregate(houses, PhysicsShapeType.MESH, { mass: 0 }, this.scene));
    const r = rng(99);
    const mat = this.mat('bodies', new Color3(0.95, 0.4, 0.5));
    for (let k = 0; k < count; k++) {
      const isBox = k % 2 === 0;
      const mesh = isBox
        ? CreateBox(`body${k}`, { size: 1.2 }, this.scene)
        : CreateSphere(`body${k}`, { diameter: 1.2, segments: 8 }, this.scene);
      mesh.material = mat;
      mesh.position.set((r() - 0.5) * 60, 25 + r() * 20, (r() - 0.5) * 60);
      this.meshes.push(mesh);
      this.aggregates.push(
        new PhysicsAggregate(
          mesh,
          isBox ? PhysicsShapeType.BOX : PhysicsShapeType.SPHERE,
          { mass: 1, restitution: 0.4, friction: 0.6 },
          this.scene,
        ),
      );
    }
    return { wasmStartMs };
  }

  private mat(name: string, color: Color3): StandardMaterial {
    const m = new StandardMaterial(`stress-${name}`, this.scene);
    m.diffuseColor = color;
    m.specularColor = Color3.Black();
    this.materials.push(m);
    return m;
  }

  dispose(): void {
    for (const a of this.aggregates) a.dispose();
    for (const m of this.meshes) m.dispose();
    for (const m of this.materials) m.dispose();
    this.aggregates.length = 0;
    this.meshes.length = 0;
    if (this.usesPhysics) releaseHavok(this.scene);
    this.usesPhysics = false;
  }
}
