import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { PhysicsBody } from '@babylonjs/core/Physics/v2/physicsBody';
import { PhysicsShapeMesh } from '@babylonjs/core/Physics/v2/physicsShape';
import { PhysicsMotionType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import type { Scene } from '@babylonjs/core/scene';
import type { ModelRegistry } from '../../assets/ModelRegistry.ts';
import { createVertexColorMaterial } from '../../engine/procedural/PartKit.ts';
import type { BuiltTile } from '../protocol.ts';
import type { TileLayer } from '../tiles/layers.ts';
import type { TileState } from '../tiles/TileState.ts';
import { groundFor, landmarkModelId, rotationY, tileOfLandmark, type LandmarkInfo } from './placement.ts';

/**
 * Wahrzeichen in Ring-0-Kacheln (Design D7): Modell aus der Registry an Grundrissmitte, Längsachse und tiefster
 * Geländehöhe; der Worker lässt das generierte Gebäude dort aus. Kollision als statisches Mesh in Weltlage.
 */
export class LandmarkLayer implements TileLayer {
  readonly name = 'landmarks';
  private readonly byTile = new Map<string, LandmarkInfo[]>();
  private readonly material: StandardMaterial;
  /** Platzierte Wahrzeichen (für Tests und Debug): ID -> Wurzelknoten. */
  readonly placed = new Map<string, TransformNode>();

  constructor(
    private readonly scene: Scene,
    private readonly registry: ModelRegistry,
    landmarks: LandmarkInfo[],
    tileSize: number,
    private readonly physics: boolean,
  ) {
    for (const l of landmarks) {
      const key = tileOfLandmark(l, tileSize);
      const list = this.byTile.get(key) ?? [];
      list.push(l);
      this.byTile.set(key, list);
    }
    this.material = createVertexColorMaterial(scene, 'landmark-mat');
  }

  /** Wahrzeichen mit vorhandenem Modell: deren Gebäude lässt der Worker in Ring 0 aus. */
  static usable(landmarks: LandmarkInfo[], registry: ModelRegistry | null): LandmarkInfo[] {
    const ids = new Set(registry?.ids ?? []);
    return landmarks.filter((l) => ids.has(landmarkModelId(l)));
  }

  upload(tile: TileState, b: BuiltTile): (() => void)[] {
    if (b.ring !== 0) return [];
    return (this.byTile.get(tile.id) ?? []).map((l) => () => this.place(tile, l));
  }

  private place(tile: TileState, l: LandmarkInfo): void {
    const ground = groundFor(l, (x, z) => tile.heightAt(x, z));
    if (ground === null) return;
    const root = new TransformNode(`landmark-${l.id}`, this.scene);
    root.position.set(l.x, ground, l.z);
    root.rotation.y = rotationY(l);
    const inst = this.registry.instantiate(landmarkModelId(l), `landmark-${l.id}`);
    for (const n of inst.rootNodes) n.parent = root;
    const meshes = root.getChildMeshes(false) as Mesh[];
    for (const m of meshes) {
      m.material = this.material;
      m.isPickable = false;
      m.hasVertexAlpha = false; // RGBA-Farben ohne echtes Alpha: nicht in den Transparenz-Durchgang
      m.receiveShadows = true;
    }
    root.computeWorldMatrix(true);
    for (const m of meshes) {
      m.computeWorldMatrix(true);
      m.freezeWorldMatrix();
    }
    const collider = this.physics ? this.addCollider(l, meshes) : null;
    this.placed.set(l.id, root);
    tile.onDispose(() => {
      this.placed.delete(l.id);
      collider?.();
      root.dispose(false, false);
    });
  }

  /** Statische Mesh-Kollision: Geometrie in Weltlage gebacken (Spiegelung des glTF-Wurzelknotens eingerechnet). */
  private addCollider(l: LandmarkInfo, meshes: Mesh[]): () => void {
    const parts = meshes
      .filter((m) => m.getTotalVertices() > 0)
      .map((m) => {
        const vd = VertexData.ExtractFromMesh(m, true, true);
        vd.transform(m.getWorldMatrix());
        return vd;
      });
    const merged = parts.length > 1 ? parts[0].merge(parts.slice(1), true) : parts[0];
    const mesh = new Mesh(`landmark-col-${l.id}`, this.scene);
    merged.applyToMesh(mesh, false);
    mesh.isVisible = false;
    mesh.isPickable = false;
    const node = new TransformNode(`landmark-colnode-${l.id}`, this.scene);
    const body = new PhysicsBody(node, PhysicsMotionType.STATIC, false, this.scene);
    body.shape = new PhysicsShapeMesh(mesh, this.scene);
    return () => {
      body.shape?.dispose();
      body.dispose();
      node.dispose();
      mesh.dispose();
    };
  }

  dispose(): void {
    this.material.dispose();
  }
}
