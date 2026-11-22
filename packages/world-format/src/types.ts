/**
 * Kachelformat von Kandern Chaos.
 *
 * Koordinaten: ETRS89 / UTM 32N (EPSG:25832) minus fester Weltursprung -> Meter um (0,0).
 * Achsen im Spiel: x = Osten, z = Norden, y = Höhe. Babylon ist linkshändig; die Pipeline
 * liefert x/z so, dass Norden im Spiel +z ist.
 *
 * Kachel (tx, tz) deckt [tx*size, (tx+1)*size) x [tz*size, (tz+1)*size) ab.
 * Polygone und Linien liegen in Kachel-lokalen Koordinaten (Ursprung = südwestliche Kachelecke).
 */

import type { TileDetails } from './detailsSection.ts';

export const FORMAT_VERSION = 1;

/** Magische Kennung am Anfang jedes Kachelblocks: "KCT1". */
export const TILE_MAGIC = 0x3154434b;

export interface TileKey {
  tx: number;
  tz: number;
}

export const tileId = (tx: number, tz: number): string => `${tx},${tz}`;

export function parseTileId(id: string): TileKey {
  const [a, b] = id.split(',');
  return { tx: Number(a), tz: Number(b) };
}

/** Globale Höhen-Quantisierung: h[m] = base + value * step. Gleich für alle Kacheln -> nahtlose Kanten. */
export interface HeightQuantization {
  base: number;
  step: number;
}

export const DEFAULT_HEIGHT_QUANT: HeightQuantization = { base: 150, step: 0.02 };

/**
 * Ein Höhenraster einer Detailstufe. `samples` Werte pro Seite inklusive beider Kanten,
 * d. h. Abstand = tileSize / (samples - 1). Zeilenweise von Süden nach Norden, je Zeile West -> Ost.
 */
export interface HeightLod {
  samples: number;
  heights: Uint16Array;
}

export enum BuildingType {
  Residential = 0,
  HalfTimbered = 1,
  Farm = 2,
  Commercial = 3,
  Industrial = 4,
  Public = 5,
  Church = 6,
  Garage = 7,
  Shed = 8,
}

export enum RoofShape {
  Flat = 0,
  Gabled = 1,
  Hipped = 2,
  Pyramidal = 3,
  Skillion = 4,
}

export interface Building {
  /** Stabile ID (OSM-Typ * 1e12 + OSM-ID, sicher als float64). */
  id: number;
  type: BuildingType;
  roof: RoofShape;
  /** Wandhöhe bis Traufe in m. */
  wallHeight: number;
  /** Dachhöhe (First - Traufe) in m; 0 bei Flachdach. */
  roofHeight: number;
  levels: number;
  /** Außenring gegen den Uhrzeigersinn, Kachel-lokal, [x0,z0,x1,z1,...] ohne Schlusspunkt. */
  outline: Float32Array;
  /** true, wenn Höhe/Dach/Typ durch Ergänzungsregeln geschätzt wurden. */
  estimated: boolean;
}

export enum RoadKind {
  Motorway = 0,
  Primary = 1,
  Secondary = 2,
  Tertiary = 3,
  Residential = 4,
  Service = 5,
  Track = 6,
  Path = 7,
  Cycleway = 8,
  Footway = 9,
  Rail = 10,
  Steps = 11,
}

export interface Road {
  id: number;
  kind: RoadKind;
  width: number;
  /** Polylinie Kachel-lokal [x0,z0,x1,z1,...]. */
  points: Float32Array;
  /** Globale Knoten-IDs an Anfang und Ende (OSM-Knoten), verbinden das Netz über Kachelgrenzen. */
  startNode: number;
  endNode: number;
  /** Name, z. B. "Hauptstraße" (leer wenn unbekannt). */
  name: string;
  bridge: boolean;
  tunnel: boolean;
}

export enum LandKind {
  ForestDeciduous = 0,
  ForestConiferous = 1,
  ForestMixed = 2,
  Meadow = 3,
  Farmland = 4,
  Orchard = 5,
  Vineyard = 6,
  Residential = 7,
  Commercial = 8,
  Industrial = 9,
  Water = 10,
  Park = 11,
  Cemetery = 12,
  Sports = 13,
}

export interface LandArea {
  kind: LandKind;
  /** Erster Ring = außen (CCW), weitere = Löcher (CW). Kachel-lokal, auf die Kachel zugeschnitten. */
  rings: Float32Array[];
}

export interface Waterway {
  kind: 'river' | 'stream' | 'ditch';
  width: number;
  points: Float32Array;
  name: string;
}

/** Zerstörbare Kleinobjekte (Abschnitt 6). */
export enum PropKind {
  Bush = 0,
  Bin = 1,
  Fence = 2,
  Sign = 3,
  Lamp = 4,
  Bench = 5,
  PostBox = 6,
  Hydrant = 7,
  Bollard = 8,
  BikeRack = 9,
  AdColumn = 10,
  Planter = 11,
}

export const PROP_KIND_COUNT = 12;

/** Schild-Varianten (Prop.variant bei PropKind.Sign). */
export const enum SignVariant {
  Round = 0,
  TrafficLight = 1,
  BusStop = 2,
  Triangle = 3,
  BlueSquare = 4,
}

export interface Prop {
  kind: PropKind;
  /** Kachel-lokal. */
  x: number;
  z: number;
  /** Drehung um die Hochachse (Radiant, 0 = Blick nach Norden). */
  rot: number;
  /** Modellvariante (z. B. Buschgröße, Schildtyp). */
  variant: number;
}

export enum VehicleKind {
  Car = 0,
  Bike = 1,
  Motorbike = 2,
}

/** Parkposition für ein Fahrzeug (Abschnitt 6). */
export interface ParkingSpot {
  /** Stabile ID (deterministisch aus Quelle + Index), z. B. für Farbe und Wiedererscheinen. */
  id: number;
  x: number;
  z: number;
  /** Fahrtrichtung als Gierwinkel (Radiant). */
  heading: number;
  kind: VehicleKind;
}

export interface TileData {
  tx: number;
  tz: number;
  /** Kantenlänge in m. */
  size: number;
  quant: HeightQuantization;
  /** Höhen-LODs, LOD0 = feinste Stufe. */
  lods: HeightLod[];
  buildings: Building[];
  roads: Road[];
  land: LandArea[];
  waterways: Waterway[];
  /** Kleinobjekte (optionaler Abschnitt 6; ältere Kacheln: leer). */
  props?: Prop[];
  /** Parkpositionen (optionaler Abschnitt 6; ältere Kacheln: leer). */
  parking?: ParkingSpot[];
  /** Darstellungsdetails (optionaler Abschnitt 7; ältere Kacheln: fehlt). */
  details?: TileDetails;
}

/** Eintrag eines Regionspakets im Index. */
export interface PackEntry {
  file: string;
  bytes: number;
  sha256: string;
}

/** Position einer Kachel: [Paketindex, Byte-Offset, Länge (komprimiert)]. */
export type TileLocation = [pack: number, offset: number, length: number];

export interface WorldIndex {
  formatVersion: number;
  /** Inhalts-Hash über alle Pakete – ändert sich mit jedem neuen Datenstand. */
  buildVersion: string;
  /** Stand der Quelldaten (ISO-Datum). */
  sourceDate: string;
  tileSize: number;
  quant: HeightQuantization;
  origin: { epsg: number; easting: number; northing: number };
  /** Kachelbereich (inklusive). */
  bounds: { minTx: number; minTz: number; maxTx: number; maxTz: number };
  /** Startpunkt des Spielers (Weltkoordinaten). */
  spawn: { x: number; z: number };
  packs: PackEntry[];
  tiles: Record<string, TileLocation>;
}
