import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { PhysicsBody } from '@babylonjs/core/Physics/v2/physicsBody';
import { PhysicsShapeHeightField, PhysicsShapeMesh } from '@babylonjs/core/Physics/v2/physicsShape';
import { PhysicsMotionType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import type { Scene } from '@babylonjs/core/scene';
import type { BuiltTile } from '../protocol.ts';
import type { TileLayer } from './layers.ts';
import type { TileState } from './TileState.ts';
import { buildingsMeshOf } from './GeometryLayer.ts';
import { toHavokHeightfield } from './heightfieldLayout.ts';

/** Kollision für Ring-0-Kacheln: Gelände als Heightfield, Gebäude als Mesh-Shape. Muss nach GeometryLayer registriert sein. */
export class CollisionLayer implements TileLayer {
  readonly name = 'collision';

  constructor(private readonly scene: Scene) {}

  upload(tile: TileState, b: BuiltTile): (() => void)[] {
    if (b.ring !== 0 || !tile.heightfield) return [];
    const hf = tile.heightfield;
    return [
      () => {
        const { data, min } = toHavokHeightfield(hf.heights, hf.samples);
        this.addBody(tile, `tcol-${b.tileId}`, tile.originX + b.size / 2, min, tile.originZ + b.size / 2, (body) => {
          body.shape = new PhysicsShapeHeightField(b.size, b.size, hf.samples, hf.samples, data, this.scene);
        });
      },
      () => {
        const bm = buildingsMeshOf(tile);
        if (bm) {
          this.addBody(tile, `bcol-${b.tileId}`, tile.originX, 0, tile.originZ, (body) => {
            body.shape = new PhysicsShapeMesh(bm, this.scene);
          });
        }
        tile.hasCollision = true;
      },
    ];
  }

  private addBody(
    tile: TileState,
    name: string,
    x: number,
    y: number,
    z: number,
    shape: (b: PhysicsBody) => void,
  ): void {
    const node = new TransformNode(name, this.scene);
    node.position.set(x, y, z);
    const body = new PhysicsBody(node, PhysicsMotionType.STATIC, false, this.scene);
    shape(body);
    tile.onDispose(() => {
      body.shape?.dispose();
      body.dispose();
      node.dispose();
    });
  }
}
