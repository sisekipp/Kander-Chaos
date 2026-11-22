import { BuildingType, DEFAULT_HEIGHT_QUANT, LandKind, RoadKind, RoofShape, type TileData } from './types.ts';

export function makeTile(tx = 3, tz = -2): TileData {
  const samples = 5;
  const heights = new Uint16Array(samples * samples).map((_, i) => 10000 + i * 7);
  return {
    tx,
    tz,
    size: 250,
    quant: DEFAULT_HEIGHT_QUANT,
    lods: [
      { samples, heights },
      { samples: 2, heights: new Uint16Array([1, 2, 3, 4]) },
    ],
    buildings: [
      {
        id: 1_000_000_000_000 + 123456789,
        type: BuildingType.HalfTimbered,
        roof: RoofShape.Gabled,
        wallHeight: 6.5,
        roofHeight: 4,
        levels: 2,
        outline: new Float32Array([10, 10, 20, 10, 20, 18, 10, 18]),
        estimated: true,
      },
    ],
    roads: [
      {
        id: 42,
        kind: RoadKind.Primary,
        width: 7,
        points: new Float32Array([0, 125, 250, 125]),
        startNode: 9_876_543_210,
        endNode: 11,
        name: 'Hauptstraße',
        bridge: true,
        tunnel: false,
      },
    ],
    land: [
      {
        kind: LandKind.ForestMixed,
        rings: [new Float32Array([0, 0, 100, 0, 100, 100, 0, 100]), new Float32Array([20, 20, 20, 30, 30, 30])],
      },
    ],
    waterways: [{ kind: 'river', width: 6, name: 'Kander', points: new Float32Array([0, 0, 50, 60]) }],
  };
}
