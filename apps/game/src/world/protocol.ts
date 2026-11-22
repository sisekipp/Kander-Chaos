import type { ParkingSpot, Prop } from '@kandern/world-format';
import type { GeometryBuffers } from './gen/GeoBuilder.ts';

/** Detailstufe einer Kachel: 0 = volle Details, 1 = vereinfacht, 2 = nur Gelände + Silhouetten. */
export type Ring = 0 | 1 | 2;

export interface BuildRequest {
  type: 'build';
  reqId: number;
  tileId: string;
  /** Absolute URL des Regionspakets. */
  packUrl: string;
  offset: number;
  length: number;
  ring: Ring;
  vegetationDensity: number;
}

export interface BuiltTile {
  type: 'built';
  reqId: number;
  tileId: string;
  ring: Ring;
  tx: number;
  tz: number;
  size: number;
  terrain: GeometryBuffers;
  buildings: GeometryBuffers | null;
  roads: GeometryBuffers | null;
  trees: { matrices: Float32Array[]; counts: number[] };
  /** Kleinobjekte und Parkpositionen (nur Ring 0, Kachel-lokal). */
  props: Prop[];
  parking: ParkingSpot[];
  /** Für Kollision (nur Ring 0): Höhenraster LOD0 in Metern. */
  heightfield: { samples: number; heights: Float32Array } | null;
  stats: { buildings: number; roads: number; genMs: number; fetchMs: number };
}

export interface BuildError {
  type: 'error';
  reqId: number;
  tileId: string;
  message: string;
}

export type WorkerResponse = BuiltTile | BuildError;
