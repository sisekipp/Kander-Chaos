import { BuildingType, LandKind, RoadKind } from '@kandern/world-format';

export type RGB = [number, number, number];

const hex = (h: number): RGB => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

/** Warme, leicht comicartige Palette (Platzhalter in Zielqualität "gut genug zum Messen"). */
export const LAND_COLORS: Record<LandKind, RGB> = {
  [LandKind.ForestDeciduous]: hex(0x4f7d3a),
  [LandKind.ForestConiferous]: hex(0x3c6338),
  [LandKind.ForestMixed]: hex(0x47703a),
  [LandKind.Meadow]: hex(0x8cba5a),
  [LandKind.Farmland]: hex(0xc9b56a),
  [LandKind.Orchard]: hex(0x9cc463),
  [LandKind.Vineyard]: hex(0xa7a356),
  [LandKind.Residential]: hex(0x9fb57e),
  [LandKind.Commercial]: hex(0xa9a99a),
  [LandKind.Industrial]: hex(0x9d9a90),
  [LandKind.Water]: hex(0x4f9ac4),
  [LandKind.Park]: hex(0x86c05a),
  [LandKind.Cemetery]: hex(0x7fa36a),
  [LandKind.Sports]: hex(0x6fb34e),
};

export const DEFAULT_GROUND: RGB = hex(0x93bd60);

/** Wandfarben je Typ; mehrere Töne, Auswahl deterministisch über die Gebäude-ID. */
export const WALL_COLORS: Record<BuildingType, RGB[]> = {
  [BuildingType.Residential]: [0xf3e6c8, 0xf6d7b0, 0xe9eef0, 0xf4efe2, 0xf2cfc0, 0xdbe6cf, 0xfbe7a1, 0xd9e2ee].map(hex),
  [BuildingType.HalfTimbered]: [0xf7f0dc, 0xf3e7c9, 0xf6efe6].map(hex),
  [BuildingType.Farm]: [0xc89a6a, 0xb7865a, 0xe8dcc0].map(hex),
  [BuildingType.Commercial]: [0xd8dde2, 0xe4d6c3, 0xc9d3dc].map(hex),
  [BuildingType.Industrial]: [0xb5bcc4, 0xa9b0a3, 0xc4c0b6].map(hex),
  [BuildingType.Public]: [0xf0e0b8, 0xe9d2a8, 0xf1e9d8].map(hex),
  [BuildingType.Church]: [0xf2ecdf, 0xe9dfca].map(hex),
  [BuildingType.Garage]: [0xd6d3cc, 0xc8c4bb].map(hex),
  [BuildingType.Shed]: [0xa47b52, 0x8f6a46].map(hex),
};

export const ROOF_COLORS: Record<'tile' | 'dark' | 'flat' | 'metal', RGB[]> = {
  tile: [0xb5503a, 0xa9452f, 0xc0613f, 0x9b4433].map(hex),
  dark: [0x5a5f66, 0x4d5157].map(hex),
  flat: [0x8a8a86, 0x7c7e7a].map(hex),
  metal: [0x7d8b93, 0x6f7a80].map(hex),
};

/** Fassadenmuster im Shader (uv2.x). */
export const enum Facade {
  Plaster = 0,
  HalfTimbered = 1,
  Wood = 2,
  Glass = 3,
  Public = 4,
  Plain = 5,
  RoofTile = 10,
  RoofFlat = 11,
}

export const FACADE_OF: Record<BuildingType, Facade> = {
  [BuildingType.Residential]: Facade.Plaster,
  [BuildingType.HalfTimbered]: Facade.HalfTimbered,
  [BuildingType.Farm]: Facade.Wood,
  [BuildingType.Commercial]: Facade.Glass,
  [BuildingType.Industrial]: Facade.Plain,
  [BuildingType.Public]: Facade.Public,
  [BuildingType.Church]: Facade.Public,
  [BuildingType.Garage]: Facade.Plain,
  [BuildingType.Shed]: Facade.Wood,
};

export const ROAD_COLORS: Record<RoadKind, RGB> = {
  [RoadKind.Motorway]: hex(0x5c5f66),
  [RoadKind.Primary]: hex(0x63666c),
  [RoadKind.Secondary]: hex(0x686b70),
  [RoadKind.Tertiary]: hex(0x6d7074),
  [RoadKind.Residential]: hex(0x74777a),
  [RoadKind.Service]: hex(0x7d7f80),
  [RoadKind.Track]: hex(0xa88d64),
  [RoadKind.Path]: hex(0xc2a878),
  [RoadKind.Cycleway]: hex(0x8a6d6d),
  [RoadKind.Footway]: hex(0xc9b48c),
  [RoadKind.Rail]: hex(0x5b4a3e),
  [RoadKind.Steps]: hex(0xb8ab98),
};

export const WATER_COLOR: RGB = hex(0x4a95c2);

export function pick<T>(list: T[], r: number): T {
  return list[Math.min(list.length - 1, Math.floor(r * list.length))];
}

/** Deterministischer Zufall [0,1) aus einer Zahl (z. B. Gebäude-ID). */
export function idRandom(id: number, salt = 0): number {
  let h = (Math.floor(id) ^ (salt * 0x9e3779b1)) >>> 0;
  h ^= Math.floor(id / 4294967296);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
