import { PropKind, SignVariant } from '@kandern/world-format';
import type { LatLon, OsmNode, OsmRelation, OsmWay, OverpassResult } from '../osm.ts';
import { assembleRings, stableId, wayRing } from '../osm.ts';
import type { ParkingLot, WorldProp } from './types.ts';
import { yawOf } from './rng.ts';
import { isZebra } from '../roads/crossings.ts';
import { isTowerPart } from '../buildings/churchTower.ts';

type Project = (p: LatLon) => [number, number];

/**
 * Schildtyp aus `traffic_sign` (mehrere Zeichen durch „;“ oder „,“ getrennt): Vorfahrt gewähren / Stopp als
 * Dreieck, Fußgängerüberweg als blaues Quadrat, sonst rundes Schild.
 */
export function signVariant(trafficSign: string): number {
  const codes = trafficSign
    .toUpperCase()
    .split(/[;,]/)
    .map((c) => c.trim());
  if (codes.some((c) => c.startsWith('DE:205') || c.startsWith('DE:206'))) return SignVariant.Triangle;
  if (codes.some((c) => c.startsWith('DE:350'))) return SignVariant.BlueSquare;
  return SignVariant.Round;
}

/** Hydrant über der Erde (Unterflurhydranten liegen im Boden und werden nicht dargestellt). */
const pillarHydrant = (t: Record<string, string>) =>
  t.emergency === 'fire_hydrant' && t['fire_hydrant:type'] !== 'underground' && t['fire_hydrant:type'] !== 'wall';

/** Teilt eine Linie in gleich lange Felder und liefert je Feld Mittelpunkt und Ausrichtung. */
export function lineSegments(coords: number[], segLen: number): { x: number; z: number; rot: number }[] {
  const out: { x: number; z: number; rot: number }[] = [];
  let carry = segLen / 2; // erstes Feld mittig auf dem ersten halben Feld
  for (let i = 2; i < coords.length; i += 2) {
    const x0 = coords[i - 2],
      z0 = coords[i - 1],
      x1 = coords[i],
      z1 = coords[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 1e-6) continue;
    const rot = yawOf(x1 - x0, z1 - z0);
    let d = carry;
    while (d <= len) {
      const t = d / len;
      out.push({ x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, rot });
      d += segLen;
    }
    carry = d - len;
  }
  return out;
}

export interface OsmProps {
  props: WorldProp[];
  lots: ParkingLot[];
  /** Spielplätze und Bushaltestellen als Ankerpunkte für Bänke/Mülleimer. */
  anchors: { x: number; z: number; kind: 'playground' | 'bus_stop' }[];
  /** Zebrastreifen-Knoten (werden in der Straßenverarbeitung der Fahrbahn zugeordnet). */
  zebras: { x: number; z: number }[];
  /** Turm-Gebäudeteile (Ringe in Weltkoordinaten) für die Lage der Kirchtürme. */
  towerParts: number[][];
}

/** Liest Straßenmöbel, Barrieren und Parkplätze aus dem Props-Abruf. */
export function readOsmProps(data: OverpassResult, project: Project): OsmProps {
  const props: WorldProp[] = [];
  const lots: ParkingLot[] = [];
  const anchors: OsmProps['anchors'] = [];
  const zebras: OsmProps['zebras'] = [];
  const towerParts: number[][] = [];
  for (const el of data.elements) {
    const t = el.tags ?? {};
    if (el.type === 'node') {
      const [x, z] = project(el as OsmNode);
      if (isZebra(t)) zebras.push({ x, z });
      else if (t.highway === 'street_lamp') props.push({ kind: PropKind.Lamp, x, z, rot: 0, variant: 0 });
      else if (t.amenity === 'waste_basket') props.push({ kind: PropKind.Bin, x, z, rot: 0, variant: 0 });
      else if (t.amenity === 'bench') props.push({ kind: PropKind.Bench, x, z, rot: 0, variant: 0 });
      else if (t.highway === 'traffic_signals')
        props.push({ kind: PropKind.Sign, x, z, rot: 0, variant: SignVariant.TrafficLight });
      else if (t.highway === 'bus_stop') {
        props.push({ kind: PropKind.Sign, x, z, rot: 0, variant: SignVariant.BusStop });
        anchors.push({ x, z, kind: 'bus_stop' });
      } else if (t.traffic_sign)
        props.push({ kind: PropKind.Sign, x, z, rot: 0, variant: signVariant(t.traffic_sign) });
      else if (t.amenity === 'post_box') props.push({ kind: PropKind.PostBox, x, z, rot: 0, variant: 0 });
      else if (pillarHydrant(t)) props.push({ kind: PropKind.Hydrant, x, z, rot: 0, variant: 0 });
      else if (t.barrier === 'bollard') props.push({ kind: PropKind.Bollard, x, z, rot: 0, variant: 0 });
      else if (t.amenity === 'bicycle_parking') props.push({ kind: PropKind.BikeRack, x, z, rot: 0, variant: 0 });
      else if (t.advertising === 'column') props.push({ kind: PropKind.AdColumn, x, z, rot: 0, variant: 0 });
      else if (t.leisure === 'playground') anchors.push({ x, z, kind: 'playground' });
    } else if (el.type === 'way') {
      const w = el as OsmWay;
      const pts = w.geometry
        .filter((g): g is LatLon => g !== null)
        .map(project)
        .flat();
      if (pts.length < 4) continue;
      if (isTowerPart(t)) {
        const ring = wayRing(w, project);
        if (ring) towerParts.push(ring.flat());
      } else if (t.barrier === 'fence' || t.barrier === 'wall') {
        for (const s of lineSegments(pts, 2.5))
          props.push({ kind: PropKind.Fence, x: s.x, z: s.z, rot: s.rot, variant: t.barrier === 'wall' ? 1 : 0 });
      } else if (t.barrier === 'hedge') {
        for (const s of lineSegments(pts, 1.8))
          props.push({ kind: PropKind.Bush, x: s.x, z: s.z, rot: s.rot, variant: 3 });
      } else if (t.amenity === 'parking') {
        const ring = wayRing(w, project);
        if (ring) lots.push({ id: stableId(w), ring: ring.flat() });
      } else if (t.leisure === 'playground') {
        const ring = wayRing(w, project);
        if (ring) {
          let sx = 0,
            sz = 0;
          for (const [x, z] of ring) {
            sx += x;
            sz += z;
          }
          anchors.push({ x: sx / ring.length, z: sz / ring.length, kind: 'playground' });
        }
      }
    } else if (el.type === 'relation' && t.amenity === 'parking') {
      for (const [k, r] of assembleRings((el as OsmRelation).members, 'outer', project).entries())
        lots.push({ id: stableId(el) + k, ring: r.flat() });
    }
  }
  return { props, lots, anchors, zebras, towerParts };
}
