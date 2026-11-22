import type { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { BuiltTile } from '../protocol.ts';
import type { WorldMaterials } from '../worldMaterials.ts';
import type { TileLayer } from './layers.ts';
import type { TileState } from './TileState.ts';
import { meshFromBuffers } from './tileMesh.ts';

/** Datenschlüssel: Gebäude-Mesh der Kachel (für die Kollision). */
export const BUILDINGS_MESH = 'geometry.buildings';

/** Gelände und Gebäude einer Kachel (Straßen: `roads/RoadLayer.ts`). */
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
          meshFromBuffers(
            this.scene,
            `terrain-${b.tileId}`,
            b.terrain,
            b.ring === 0 ? this.materials.terrain : this.materials.terrainSimple,
            tile.root,
          ),
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
    return steps;
  }
}

export const buildingsMeshOf = (tile: TileState): Mesh | undefined => tile.data.get(BUILDINGS_MESH) as Mesh | undefined;
