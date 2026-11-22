import { BuildingType, DEFAULT_HEIGHT_QUANT, RoadKind, RoofShape, type TileData } from '@kandern/world-format';

/** Testkachel: Wohnstraße bei z=50, Fußweg bei x=50, ein Haus bei (100..112, 100..110). */
export function propTile(tx = 0, tz = 0): TileData {
  return {
    tx,
    tz,
    size: 250,
    quant: DEFAULT_HEIGHT_QUANT,
    lods: [{ samples: 2, heights: new Uint16Array(4) }],
    buildings: [
      {
        id: 1e12 + 1,
        type: BuildingType.Residential,
        roof: RoofShape.Gabled,
        wallHeight: 6,
        roofHeight: 3,
        levels: 2,
        estimated: true,
        outline: new Float32Array([100, 100, 112, 100, 112, 110, 100, 110]),
      },
    ],
    roads: [
      {
        id: 7000,
        kind: RoadKind.Residential,
        width: 6,
        points: new Float32Array([0, 50, 250, 50]),
        startNode: 1,
        endNode: 2,
        name: '',
        bridge: false,
        tunnel: false,
      },
      {
        id: 8000,
        kind: RoadKind.Footway,
        width: 2,
        points: new Float32Array([50, 0, 50, 250]),
        startNode: 3,
        endNode: 4,
        name: '',
        bridge: false,
        tunnel: false,
      },
    ],
    land: [],
    waterways: [],
  };
}
