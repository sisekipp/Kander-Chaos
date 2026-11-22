import type { Material } from '@babylonjs/core/Materials/material';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { PhysicsBody } from '@babylonjs/core/Physics/v2/physicsBody';
import { PhysicsMotionType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import { PhysicsShapeMesh } from '@babylonjs/core/Physics/v2/physicsShape';
import type { Scene } from '@babylonjs/core/scene';
import type { BuiltTile } from '../protocol.ts';
import type { TileLayer } from '../tiles/layers.ts';
import type { TileState } from '../tiles/TileState.ts';
import { meshFromBuffers } from '../tiles/tileMesh.ts';

/** Datenschlüssel: Straßen-Mesh der Kachel. */
export const ROADS_MESH = 'roads.mesh';

/**
 * Straßen einer Kachel als ein Mesh mit einem Material (ein Draw Call), Wasser als zweites Mesh, plus
 * Brücken-Kollision in Ring 0:
 * die Brückenfahrbahnen als unsichtbares Mesh mit statischem Mesh-Shape (wenige Dreiecke).
 */
export class RoadLayer implements TileLayer {
  readonly name = 'roads';

  constructor(
    private readonly scene: Scene,
    private readonly material: Material,
    private readonly physics: boolean,
    private readonly waterMaterial: Material | null = null,
  ) {}

  upload(tile: TileState, b: BuiltTile): (() => void)[] {
    const steps: (() => void)[] = [];
    const roads = b.roads;
    if (roads)
      steps.push(() => {
        const m = meshFromBuffers(this.scene, `roads-${b.tileId}`, roads, this.material, tile.root);
        tile.meshes.push(m);
        tile.data.set(ROADS_MESH, m);
      });
    const water = b.water;
    if (water && this.waterMaterial) {
      const mat = this.waterMaterial;
      steps.push(() => tile.meshes.push(meshFromBuffers(this.scene, `water-${b.tileId}`, water, mat, tile.root)));
    }
    const bridges = b.bridges;
    if (bridges && b.ring === 0 && this.physics)
      steps.push(() => {
        const mesh = meshFromBuffers(this.scene, `bridgecol-mesh-${b.tileId}`, bridges, this.material, tile.root);
        mesh.isVisible = false;
        mesh.material = null;
        tile.meshes.push(mesh);
        const node = new TransformNode(`bridgecol-${b.tileId}`, this.scene);
        node.position.set(tile.originX, 0, tile.originZ);
        const body = new PhysicsBody(node, PhysicsMotionType.STATIC, false, this.scene);
        body.shape = new PhysicsShapeMesh(mesh, this.scene);
        tile.onDispose(() => {
          body.shape?.dispose();
          body.dispose();
          node.dispose();
        });
      });
    return steps;
  }
}
