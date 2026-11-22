import { RoadKind, Surface, sampleHeight, type Road, type RoadDetail, type TileData } from '@kandern/world-format';
import { GeoBuilder, type GeometryBuffers } from '../gen/GeoBuilder.ts';
import { addPiers, addTunnelPortal, pierSpots, tunnelEnds } from './bridgeMesh.ts';
import { addCrossing, addJunction } from './junctionMesh.ts';
import { addRoundabout } from './roundaboutMesh.ts';
import { roadProfile } from './profile.ts';
import { ROAD_LIFT, extrudeRibbon } from './ribbon.ts';

export interface RoadGeometry {
  /** Alle sichtbaren Straßenteile (ein Mesh, ein Material). */
  roads: GeometryBuffers | null;
  /** Nur Brückenfahrbahnen (für die Kollision in Ring 0). */
  bridges: GeometryBuffers | null;
}

/** Ersatz für Kacheln ohne Abschnitt 7 (ältere Weltdaten). */
function fallbackDetail(r: Road): RoadDetail {
  return {
    lanes: r.kind <= RoadKind.Tertiary ? 2 : r.kind <= RoadKind.Service ? 1 : 0,
    oneway: false,
    sidewalkLeft: false,
    sidewalkRight: false,
    surface: r.kind === RoadKind.Track ? Surface.Gravel : Surface.Asphalt,
    layer: r.bridge ? 1 : r.tunnel ? -1 : 0,
    trimStart: 0,
    trimEnd: 0,
    deckStart: NaN,
    deckEnd: NaN,
  };
}

/** Wege liegen etwas tiefer als Fahrbahnen: kreuzende Fußwege verschwinden unter der Straße. */
const liftOf = (kind: RoadKind) => ROAD_LIFT + (kind <= RoadKind.Service ? 0.03 : kind === RoadKind.Rail ? 0.01 : 0);

/**
 * Straßen-Geometrie einer Kachel (Worker): Querschnitte entlang der Straßen mit Kürzung an Kreuzungen,
 * Kreuzungsflächen, Zebrastreifen, Brücken (Deck, Geländer, Pfeiler) und Tunnelportale (Gewässer: water/).
 * `simple` (Ring 1): flache Bänder ohne Gehwege, Kreuzungen und Details.
 */
export function buildRoadGeometry(tile: TileData, opts: { simple: boolean }): RoadGeometry {
  const g = new GeoBuilder(true);
  const deck = new GeoBuilder(true);
  const lod = tile.lods[0];
  const ground = (x: number, z: number) =>
    sampleHeight(tile, lod, Math.min(tile.size, Math.max(0, x)), Math.min(tile.size, Math.max(0, z)));
  const details = tile.details?.roads;
  const order = tile.roads
    .map((r, i) => ({ r, d: details?.[i] ?? fallbackDetail(r) }))
    .sort((a, b) => a.d.layer - b.d.layer || a.r.width - b.r.width || a.r.id - b.r.id);
  for (const { r, d } of order) {
    // Kreisverkehr-Stücke zeichnet der Ring (addRoundabout in der Kachel der Mitte, auch über die
    // Kachelgrenze hinaus), nicht das Band – außer im vereinfachten Ring 1
    if (d.roundabout && !opts.simple) continue;
    if (r.tunnel) {
      if (!opts.simple)
        for (const e of tunnelEnds(r.points, r.startNode, r.endNode))
          addTunnelPortal(g, e.x, e.z, e.dx, e.dz, r.width, ground(e.x, e.z));
      continue;
    }
    const isBridge = !Number.isNaN(d.deckStart) && !Number.isNaN(d.deckEnd);
    const profile = roadProfile(r.kind, r.width, d, { bridge: isBridge, simple: opts.simple });
    const input = {
      points: r.points,
      profile,
      trimStart: opts.simple ? 0 : d.trimStart,
      trimEnd: opts.simple ? 0 : d.trimEnd,
      ground,
      deckStart: d.deckStart,
      deckEnd: d.deckEnd,
      lift: liftOf(r.kind),
    };
    extrudeRibbon(g, input);
    if (isBridge && !opts.simple) {
      // Kollision: nur die Fahrfläche (inkl. Gehweg) ohne Geländer, ungekürzt
      const flat = roadProfile(r.kind, r.width, { ...d, sidewalkLeft: false, sidewalkRight: false }, { simple: true });
      flat.segments[0].a.c = -profile.totalWidth / 2;
      flat.segments[0].b.c = profile.totalWidth / 2;
      extrudeRibbon(deck, { ...input, profile: flat, trimStart: 0, trimEnd: 0 });
      addPiers(g, pierSpots(r.points, d.deckStart, d.deckEnd, ground), r.width);
    }
  }
  if (!opts.simple) {
    for (const j of tile.details?.junctions ?? []) addJunction(g, j, ground);
    for (const c of tile.details?.crossings ?? []) addCrossing(g, c, ground);
    for (const k of tile.details?.roundabouts ?? []) addRoundabout(g, k, ground);
  }
  return { roads: g.build(), bridges: deck.build() };
}
