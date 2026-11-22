import type { BuiltTile } from '../world/protocol.ts';
import type { TileLayer } from '../world/tiles/layers.ts';
import type { TileState } from '../world/tiles/TileState.ts';
import type { Spot } from './selection.ts';

const KEY = 'parking.spots';

/** Legt die Parkpositionen einer Ring-0-Kachel (Weltkoordinaten) an der Kachel ab und meldet Entladen. */
export class ParkingLayer implements TileLayer {
  readonly name = 'parking';

  constructor(private readonly onUnload: (tileId: string, spotIds: number[]) => void) {}

  upload(tile: TileState, b: BuiltTile): (() => void)[] {
    if (!b.parking.length) return [];
    return [
      () => {
        const spots: Spot[] = b.parking.map((p) => ({
          id: p.id,
          kind: p.kind,
          heading: p.heading,
          x: tile.originX + p.x,
          z: tile.originZ + p.z,
          tileId: tile.id,
        }));
        tile.data.set(KEY, spots);
      },
    ];
  }

  onTileUnload(tile: TileState): void {
    const spots = spotsOf(tile);
    if (spots.length)
      this.onUnload(
        tile.id,
        spots.map((s) => s.id),
      );
  }
}

export const spotsOf = (tile: TileState): Spot[] => (tile.data.get(KEY) as Spot[] | undefined) ?? [];
