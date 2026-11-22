import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import type { Scene } from '@babylonjs/core/scene';
import type { BuiltTile } from '../protocol.ts';
import type { TileLayer } from '../tiles/layers.ts';
import type { TileState } from '../tiles/TileState.ts';
import { offsetInstanceMatrices } from './instances.ts';

/**
 * Bäume einer Kachel als Thin Instances je Baumart (höchstens 5 Draw Calls je Kachel).
 * Wichtig (aus Phase 0): eigene Geometrie-Kopie je Mesh – Instanzpuffer hängen an der Geometrie –
 * und kein Elternknoten (unter eingefrorenem Elternknoten wurden Instanzen nicht gezeichnet);
 * deshalb werden Weltkoordinaten in die Matrizen eingebacken.
 */
export class TreeLayer implements TileLayer {
  readonly name = 'trees';
  private readonly vertexData: VertexData[] = [];

  constructor(
    private readonly scene: Scene,
    private readonly bases: Mesh[],
  ) {}

  private dataFor(species: number): VertexData {
    return (this.vertexData[species] ??= VertexData.ExtractFromMesh(this.bases[species], true, true));
  }

  upload(tile: TileState, b: BuiltTile): (() => void)[] {
    return [
      () => {
        b.trees.matrices.forEach((m, sp) => {
          if (b.trees.counts[sp] === 0) return;
          const inst = new Mesh(`trees${sp}-${b.tileId}`, this.scene);
          this.dataFor(sp).applyToMesh(inst);
          inst.material = this.bases[sp].material;
          offsetInstanceMatrices(m, tile.originX, tile.originZ);
          inst.thinInstanceSetBuffer('matrix', m, 16, true);
          // Tönung je Baum (instanceColor im Licht-Shader)
          const colors = b.trees.colors[sp];
          if (colors) inst.thinInstanceSetBuffer('color', colors, 4, true);
          inst.thinInstanceRefreshBoundingInfo(false);
          inst.isPickable = false;
          inst.setEnabled(false); // wird mit der Kachel sichtbar
          tile.meshes.push(inst);
        });
      },
    ];
  }
}
