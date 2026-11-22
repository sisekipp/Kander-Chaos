import type { ByteReader, ByteWriter } from './bytes.ts';

/** Belag einer Straße (Abschnitt 7). */
export enum Surface {
  Asphalt = 0,
  Paving = 1,
  Gravel = 2,
  Dirt = 3,
  Grass = 4,
  Concrete = 5,
}

/** Darstellungsattribute je Straße, Index wie im Straßenabschnitt. */
export interface RoadDetail {
  /** Fahrstreifen gesamt (0 = keine Fahrbahn, z. B. Fußweg). */
  lanes: number;
  oneway: boolean;
  sidewalkLeft: boolean;
  sidewalkRight: boolean;
  surface: Surface;
  /** OSM-Ebene (layer), −5 … 5. */
  layer: number;
  /** Kürzung in m am Anfang/Ende, weil dort ein Kreuzungspolygon liegt. */
  trimStart: number;
  trimEnd: number;
  /** Fahrbahnhöhe der Brücke in m am Anfang/Ende des Teilstücks; NaN = keine Brücke. */
  deckStart: number;
  deckEnd: number;
  /** Teil eines Kreisverkehrs: wird nicht als Band gezeichnet, sondern als Ring (siehe `Roundabout`). */
  roundabout?: boolean;
}

/** Kreuzungsfläche um einen Knoten mit ≥ 3 Armen (Kachel des Knotens). */
export interface Junction {
  node: number;
  /** Ring CCW, Kachel-lokal [x0,z0,…]. */
  ring: Float32Array;
  /** true = Rückfall auf Kreisscheibe (unsaubere Geometrie). */
  fallback: boolean;
}

/** Zebrastreifen: Mitte, Querrichtung (Laufrichtung der Fußgänger, normiert) und Länge in m. */
export interface Crossing {
  x: number;
  z: number;
  dirX: number;
  dirZ: number;
  length: number;
}

/** Kirchturm: Gebäude-ID, Mitte, Kantenlänge und Drehung (Kachel-lokal). */
export interface ChurchTower {
  buildingId: number;
  x: number;
  z: number;
  size: number;
  rot: number;
}

/** Kreisverkehr: Mitte (Kachel-lokal), Radius der Fahrbahnmitte und Fahrbahnbreite in m. */
export interface Roundabout {
  x: number;
  z: number;
  radius: number;
  width: number;
}

export interface TileDetails {
  roads: RoadDetail[];
  junctions: Junction[];
  crossings: Crossing[];
  churchTowers: ChurchTower[];
  /** Kreisverkehre (in der Kachel ihrer Mitte); fehlt in älteren Daten. */
  roundabouts: Roundabout[];
}

const FLAG_ONEWAY = 1;
const FLAG_SIDEWALK_LEFT = 2;
const FLAG_SIDEWALK_RIGHT = 4;
const FLAG_ROUNDABOUT = 8;

export const emptyDetails = (): TileDetails => ({
  roads: [],
  junctions: [],
  crossings: [],
  churchTowers: [],
  roundabouts: [],
});

export function hasDetails(d: TileDetails | undefined): d is TileDetails {
  return (
    !!d &&
    (d.roads.length > 0 ||
      d.junctions.length > 0 ||
      d.crossings.length > 0 ||
      d.churchTowers.length > 0 ||
      d.roundabouts.length > 0)
  );
}

/** Abschnitt 7 „Details“. Optional und hinten angehängt wie Abschnitt 6. */
export function writeDetails(s: ByteWriter, d: TileDetails, roadCount: number): void {
  if (d.roads.length !== 0 && d.roads.length !== roadCount) {
    throw new Error(`Details: ${d.roads.length} Straßenattribute für ${roadCount} Straßen`);
  }
  s.u32(d.roads.length);
  for (const r of d.roads) {
    s.u8v(r.lanes);
    s.u8v(
      (r.oneway ? FLAG_ONEWAY : 0) |
        (r.sidewalkLeft ? FLAG_SIDEWALK_LEFT : 0) |
        (r.sidewalkRight ? FLAG_SIDEWALK_RIGHT : 0) |
        (r.roundabout ? FLAG_ROUNDABOUT : 0),
    );
    s.u8v(r.surface);
    s.u8v(r.layer & 0xff);
    s.f32(r.trimStart);
    s.f32(r.trimEnd);
    s.f32(r.deckStart);
    s.f32(r.deckEnd);
  }
  s.u32(d.junctions.length);
  for (const j of d.junctions) {
    s.f64(j.node);
    s.u8v(j.fallback ? 1 : 0);
    s.f32Array(j.ring);
  }
  s.u32(d.crossings.length);
  for (const c of d.crossings) {
    s.f32(c.x);
    s.f32(c.z);
    s.f32(c.dirX);
    s.f32(c.dirZ);
    s.f32(c.length);
  }
  s.u32(d.churchTowers.length);
  for (const t of d.churchTowers) {
    s.f64(t.buildingId);
    s.f32(t.x);
    s.f32(t.z);
    s.f32(t.size);
    s.f32(t.rot);
  }
  s.u32(d.roundabouts.length);
  for (const k of d.roundabouts) {
    s.f32(k.x);
    s.f32(k.z);
    s.f32(k.radius);
    s.f32(k.width);
  }
}

export function readDetails(r: ByteReader): TileDetails {
  const d = emptyDetails();
  const nr = r.u32();
  for (let i = 0; i < nr; i++) {
    const lanes = r.u8v();
    const flags = r.u8v();
    const surface = r.u8v();
    const raw = r.u8v();
    d.roads.push({
      lanes,
      oneway: (flags & FLAG_ONEWAY) !== 0,
      sidewalkLeft: (flags & FLAG_SIDEWALK_LEFT) !== 0,
      sidewalkRight: (flags & FLAG_SIDEWALK_RIGHT) !== 0,
      roundabout: (flags & FLAG_ROUNDABOUT) !== 0,
      surface,
      layer: raw > 127 ? raw - 256 : raw,
      trimStart: r.f32(),
      trimEnd: r.f32(),
      deckStart: r.f32(),
      deckEnd: r.f32(),
    });
  }
  const nj = r.u32();
  for (let i = 0; i < nj; i++) {
    const node = r.f64();
    const fallback = r.u8v() === 1;
    d.junctions.push({ node, fallback, ring: r.f32Array() });
  }
  const nc = r.u32();
  for (let i = 0; i < nc; i++)
    d.crossings.push({ x: r.f32(), z: r.f32(), dirX: r.f32(), dirZ: r.f32(), length: r.f32() });
  const nt = r.u32();
  for (let i = 0; i < nt; i++) {
    const buildingId = r.f64();
    d.churchTowers.push({ buildingId, x: r.f32(), z: r.f32(), size: r.f32(), rot: r.f32() });
  }
  // Kreisverkehre kamen später dazu: ältere Abschnitte enden vorher
  if (r.remaining >= 4) {
    const nk = r.u32();
    for (let i = 0; i < nk; i++) d.roundabouts.push({ x: r.f32(), z: r.f32(), radius: r.f32(), width: r.f32() });
  }
  return d;
}
