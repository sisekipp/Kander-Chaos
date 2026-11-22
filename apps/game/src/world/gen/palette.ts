import { BuildingType, LandKind } from '@kandern/world-format';

export type RGB = [number, number, number];

const hex = (h: number): RGB => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

/** Warme, leicht comicartige Palette; Bodenfarben gedämpft, weil der Boden das volle Himmels- und Sonnenlicht bekommt. */
export const LAND_COLORS: Record<LandKind, RGB> = {
  [LandKind.ForestDeciduous]: hex(0x456b34),
  [LandKind.ForestConiferous]: hex(0x37583a),
  [LandKind.ForestMixed]: hex(0x3f6236),
  [LandKind.Meadow]: hex(0x7aa04e),
  [LandKind.Farmland]: hex(0xb59d5c),
  [LandKind.Orchard]: hex(0x86a854),
  [LandKind.Vineyard]: hex(0x969150),
  [LandKind.Residential]: hex(0x8da06e),
  [LandKind.Commercial]: hex(0xa9a99a),
  [LandKind.Industrial]: hex(0x9d9a90),
  [LandKind.Water]: hex(0x3d6b73),
  [LandKind.Park]: hex(0x74a64e),
  [LandKind.Cemetery]: hex(0x6f8f5d),
  [LandKind.Sports]: hex(0x63a046),
};

export const DEFAULT_GROUND: RGB = hex(0x7fa451);

/** Wandfarben je Typ (Markgräflerland: Weiß, Elfenbein, helles Ocker), Auswahl deterministisch über die Gebäude-ID. */
export const WALL_COLORS: Record<BuildingType, RGB[]> = {
  [BuildingType.Residential]: [0xf6f1e6, 0xf3e9d2, 0xefdcb2, 0xf4ecdc, 0xe9d4a7, 0xf7f3ea, 0xeee2c8, 0xf1e4cf].map(hex),
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

/** Fassadenmuster im Shader (uv2.x = Fassade + 100 · Ladenfarbe, siehe `ShutterColor`). */
export const enum Facade {
  Plaster = 0,
  HalfTimbered = 1,
  Wood = 2,
  Glass = 3,
  Public = 4,
  Plain = 5,
  /** Haustür (eigene Fläche vor der Wand, uv 0 … 1). */
  Door = 6,
  /** Kirchenschiff mit Rundbogenfenstern und Kirchturm mit Schallöffnungen. */
  ChurchNave = 7,
  ChurchTower = 8,
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
  [BuildingType.Church]: Facade.ChurchNave,
  [BuildingType.Garage]: Facade.Plain,
  [BuildingType.Shed]: Facade.Wood,
};

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
