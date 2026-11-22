import { emptyDetails, type RoadDetail, type TileData, type TileDetails } from '@kandern/world-format';
import { churchTowers } from '../buildings/churchTower.ts';
import { buildBridges, type HeightFn } from './bridges.ts';
import { placeCrossings } from './crossings.ts';
import { buildJunctions } from './junctions.ts';
import { buildRoundabouts } from './roundabouts.ts';
import type { RoadPart, WayPiece } from './network.ts';

export interface DetailInputs {
  /** Alle Wegstücke in Weltkoordinaten (vor dem Kachelschnitt). */
  pieces: WayPiece[];
  /** Herkunft der Kachel-Teilstücke je Kachel (gleicher Index wie `tile.roads`). */
  parts: Map<string, RoadPart[]>;
  ground: HeightFn;
  /** Zebrastreifen-Knoten (Welt). */
  zebras: { x: number; z: number }[];
  /** Turm-Gebäudeteile (Welt). */
  towerParts: number[][];
}

const local = (ring: number[], x0: number, z0: number) => ring.map((v, i) => (i % 2 ? v - z0 : v - x0));
const inTile = (x: number, z: number, x0: number, z0: number, size: number) =>
  x >= x0 && x < x0 + size && z >= z0 && z < z0 + size;

export interface DetailStats {
  junctions: number;
  fallback: number;
  bridges: number;
  crossings: number;
  towers: number;
  roundabouts: number;
}

/** Ergänzt alle Kacheln um Abschnitt 7 (Straßenattribute, Kreuzungen, Brücken, Zebrastreifen, Kirchtürme). */
export function addDetailsToTiles(tiles: TileData[], input: DetailInputs): DetailStats {
  const rb = buildRoundabouts(input.pieces);
  const ringNodes = new Set(rb.shapes.flatMap((s) => [...s.nodes]));
  const ringPieces = new Set(rb.shapes.flatMap((s) => [...s.pieceIds]));
  const { junctions, trims } = buildJunctions(input.pieces, ringNodes);
  // Zufahrten von Kreisverkehren: Kürzung bis an den Ring ersetzt die Kreuzungskürzung
  for (const [id, t] of rb.trims) {
    const tr = trims.get(id) ?? { start: 0, end: 0 };
    if (t.start !== undefined) tr.start = t.start;
    if (t.end !== undefined) tr.end = t.end;
    trims.set(id, tr);
  }
  const decks = buildBridges(input.pieces, input.ground);
  const crossings = placeCrossings(input.zebras, input.pieces);
  const stats: DetailStats = {
    junctions: junctions.length,
    fallback: 0,
    bridges: 0,
    crossings: 0,
    towers: 0,
    roundabouts: rb.shapes.length,
  };
  stats.fallback = junctions.filter((j) => j.fallback).length;
  for (const t of tiles) {
    const x0 = t.tx * t.size,
      z0 = t.tz * t.size;
    const d: TileDetails = emptyDetails();
    const parts = input.parts.get(`${t.tx},${t.tz}`) ?? [];
    d.roads = t.roads.map((r, i): RoadDetail => {
      const part = parts[i];
      const tr = trims.get(part.piece.id);
      const deck = decks.get(part.piece.id);
      const n = r.points.length;
      if (deck) stats.bridges++;
      return {
        ...part.piece.attrs,
        // nur Stücke angenommener Kreisverkehre (verworfene Ringe bleiben normale Bänder)
        roundabout: ringPieces.has(part.piece.id),
        trimStart: part.atStart ? (tr?.start ?? 0) : 0,
        trimEnd: part.atEnd ? (tr?.end ?? 0) : 0,
        deckStart: deck ? deck(r.points[0] + x0, r.points[1] + z0) : NaN,
        deckEnd: deck ? deck(r.points[n - 2] + x0, r.points[n - 1] + z0) : NaN,
      };
    });
    for (const j of junctions) {
      if (inTile(j.x, j.z, x0, z0, t.size))
        d.junctions.push({ node: j.node, fallback: j.fallback, ring: new Float32Array(local(j.ring, x0, z0)) });
    }
    for (const k of rb.shapes) {
      if (inTile(k.x, k.z, x0, z0, t.size))
        d.roundabouts.push({ x: k.x - x0, z: k.z - z0, radius: k.radius, width: k.width });
    }
    for (const c of crossings) {
      if (inTile(c.x, c.z, x0, z0, t.size)) d.crossings.push({ ...c, x: c.x - x0, z: c.z - z0 });
    }
    d.churchTowers = churchTowers(
      t.buildings,
      input.towerParts.map((p) => local(p, x0, z0)),
    );
    stats.crossings += d.crossings.length;
    stats.towers += d.churchTowers.length;
    t.details = d;
  }
  return stats;
}
