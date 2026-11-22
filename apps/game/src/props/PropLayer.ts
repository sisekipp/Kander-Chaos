import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { PROP_KIND_COUNT, type PropKind } from '@kandern/world-format';
import type { Scene } from '@babylonjs/core/scene';
import type { BuiltTile } from '../world/protocol.ts';
import type { TileLayer } from '../world/tiles/layers.ts';
import type { TileState } from '../world/tiles/TileState.ts';
import { HitGrid } from './hitGrid.ts';
import { RebuildTracker } from './rebuild.ts';
import { PROP_RULES } from './triggers.ts';

/** Ein Kleinobjekt in Weltkoordinaten mit Verweis auf seine Instanz. */
export interface WorldPropRef {
  index: number;
  kind: PropKind;
  x: number;
  y: number;
  z: number;
  rot: number;
  scale: number;
  /** Index innerhalb des Instanzpuffers seiner Art. */
  slot: number;
}

/** Kleinobjekte einer Ring-0-Kachel: Instanz-Meshes je Art, Trefferraster, Wiederaufbau-Zustand. */
export interface TileProps {
  tileId: string;
  props: WorldPropRef[];
  meshes: (Mesh | null)[];
  matrices: (Float32Array | null)[];
  grid: HitGrid;
  rebuild: RebuildTracker;
}

const KEY = 'props.tile';

export const tilePropsOf = (t: TileState): TileProps | undefined => t.data.get(KEY) as TileProps | undefined;

/** Schreibt die Instanzmatrix eines Props (Drehung um Y, Skalierung, Translation; 0 = ausgeblendet). */
export function writeMatrix(m: Float32Array, slot: number, p: WorldPropRef, visible: boolean): void {
  const s = visible ? p.scale : 0;
  const c = Math.cos(p.rot) * s,
    sn = Math.sin(p.rot) * s;
  m.set([c, 0, -sn, 0, 0, s, 0, 0, sn, 0, c, 0, p.x, p.y, p.z, 1], slot * 16);
}

/**
 * Lädt Kleinobjekte als Thin Instances je Art (höchstens 6 Draw Calls je Kachel). Wie bei den Bäumen:
 * eigene Geometrie-Kopie je Mesh, kein Elternknoten, Weltkoordinaten in den Matrizen.
 */
export class PropLayer implements TileLayer {
  readonly name = 'props';
  private readonly vertexData: VertexData[] = [];

  constructor(
    private readonly scene: Scene,
    private readonly bases: Mesh[],
    private readonly heightAt: (tile: TileState, x: number, z: number) => number,
    private readonly events: { ready(p: TileProps): void; unload(tileId: string): void },
  ) {}

  upload(tile: TileState, b: BuiltTile): (() => void)[] {
    if (!b.props.length) return [];
    return [
      () => {
        const props: WorldPropRef[] = [];
        const counts: number[] = Array.from({ length: PROP_KIND_COUNT }, () => 0);
        const grid = new HitGrid();
        b.props.forEach((p, index) => {
          const x = tile.originX + p.x,
            z = tile.originZ + p.z;
          const scale = p.kind === 0 ? 0.8 + (p.variant % 3) * 0.2 : 1; // Buschgrößen
          const ref: WorldPropRef = {
            index,
            kind: p.kind,
            x,
            z,
            y: this.heightAt(tile, x, z) - 0.05,
            rot: p.rot,
            scale,
            slot: counts[p.kind]++,
          };
          props.push(ref);
          grid.add({ index, x, z, radius: PROP_RULES[p.kind].radius * scale });
        });
        const meshes: (Mesh | null)[] = [],
          matrices: (Float32Array | null)[] = [];
        for (let k = 0; k < PROP_KIND_COUNT; k++) {
          if (!counts[k]) {
            meshes.push(null);
            matrices.push(null);
            continue;
          }
          const m = new Float32Array(counts[k] * 16);
          for (const p of props) if (p.kind === k) writeMatrix(m, p.slot, p, true);
          const mesh = new Mesh(`props${k}-${tile.id}`, this.scene);
          (this.vertexData[k] ??= VertexData.ExtractFromMesh(this.bases[k], true, true)).applyToMesh(mesh, true);
          mesh.material = this.bases[k].material;
          mesh.thinInstanceSetBuffer('matrix', m, 16, false);
          mesh.thinInstanceRefreshBoundingInfo(false);
          mesh.isPickable = false;
          mesh.setEnabled(false);
          tile.meshes.push(mesh);
          meshes.push(mesh);
          matrices.push(m);
        }
        tile.data.set(KEY, {
          tileId: tile.id,
          props,
          meshes,
          matrices,
          grid,
          rebuild: new RebuildTracker(),
        } satisfies TileProps);
      },
    ];
  }

  onTileReady(tile: TileState): void {
    const p = tilePropsOf(tile);
    if (p) this.events.ready(p);
  }

  onTileUnload(tile: TileState): void {
    if (tilePropsOf(tile)) this.events.unload(tile.id);
  }
}
