import type { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { BuiltTile } from '../protocol.ts';
import type { WorldMaterials } from '../materials.ts';
import type { TileLayer } from './layers.ts';
import type { TileState } from './TileState.ts';
import { meshFromBuffers } from './tileMesh.ts';

/** Datenschlüssel: Gebäude-Mesh der Kachel (für die Kollision). */
export const BUILDINGS_MESH = 'geometry.buildings';

/** Gelände, Gebäude und Straßen einer Kachel. */
export class GeometryLayer implements TileLayer {
  readonly name = 'geometry';

  constructor(
    private readonly scene: Scene,
    private readonly materials: WorldMaterials,
  ) {}

  upload(tile: TileState, b: BuiltTile): (() => void)[] {
    const steps: (() => void)[] = [
      () =>
        tile.meshes.push(
          meshFromBuffers(this.scene, `terrain-${b.tileId}`, b.terrain, this.materials.terrain, tile.root),
        ),
    ];
    if (b.buildings) {
      const g = b.buildings;
      steps.push(() => {
        const m = meshFromBuffers(
          this.scene,
          `buildings-${b.tileId}`,
          g,
          b.ring === 0 ? this.materials.buildings : this.materials.buildingsSimple,
          tile.root,
        );
        tile.meshes.push(m);
        tile.data.set(BUILDINGS_MESH, m);
      });
    }
    if (b.roads) {
      const g = b.roads;
      steps.push(() =>
        tile.meshes.push(meshFromBuffers(this.scene, `roads-${b.tileId}`, g, this.materials.roads, tile.root)),
      );
    }
    return steps;
  }
}

export const buildingsMeshOf = (tile: TileState): Mesh | undefined => tile.data.get(BUILDINGS_MESH) as Mesh | undefined;
