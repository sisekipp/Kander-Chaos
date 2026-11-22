import { RoadKind, VehicleKind, orientedRect, pointInRing, type TileData } from '@kandern/world-format';
import type { ConflictMap } from './conflicts.ts';
import { rngFrom, yawOf } from './rng.ts';
import type { ParkingLot, WorldParking } from './types.ts';

/** Synthetische Knoten-IDs an Kachelschnitten beginnen bei 4e15 – das sind keine echten Kreuzungen. */
const isRealNode = (id: number): boolean => id < 4e15;

export const MIN_SPACING = 6;
export const JUNCTION_CLEARANCE = 15;
const CAR_RADIUS = 1.3;
/** Randplätze: Mittelpunkt 1,3 m hinter der Fahrbahnkante – das Auto reicht bis an die Kante, deshalb kleinerer Prüfradius. */
const ROADSIDE_CHECK = 0.6;

/**
 * Parkpositionen je Kachel (deterministisch):
 * - am Rand von Wohn- und Nebenstraßen alle 6–10 m mit 25 % Wahrscheinlichkeit, Abstand Breite/2 + 1,3 m,
 *   in Fahrtrichtung ausgerichtet, nicht näher als 15 m an echten Kreuzungen;
 * - als Raster (2,8 × 5,5 m) in Parkplatzflächen, höchstens 30 je Fläche;
 * - ca. 10 % Zweiräder (je zur Hälfte Fahrrad/Motorrad); untereinander ≥ 6 m Abstand.
 */
export function placeParking(tile: TileData, map: ConflictMap, lots: ParkingLot[]): WorldParking[] {
  const out: WorldParking[] = [];
  const ox = tile.tx * tile.size,
    oz = tile.tz * tile.size;
  const junctions: [number, number][] = [];
  for (const r of tile.roads) {
    const n = r.points.length;
    if (isRealNode(r.startNode)) junctions.push([ox + r.points[0], oz + r.points[1]]);
    if (isRealNode(r.endNode)) junctions.push([ox + r.points[n - 2], oz + r.points[n - 1]]);
  }
  const tooClose = (x: number, z: number) =>
    out.some((p) => Math.hypot(p.x - x, p.z - z) < MIN_SPACING) ||
    junctions.some(([jx, jz]) => Math.hypot(jx - x, jz - z) < JUNCTION_CLEARANCE);
  const kindFor = (r: number): VehicleKind =>
    r < 0.05 ? VehicleKind.Bike : r < 0.1 ? VehicleKind.Motorbike : VehicleKind.Car;
  const tryPlace = (p: WorldParking): void => {
    if (!map.inTile(p.x, p.z) || tooClose(p.x, p.z) || !map.isFree(p.x, p.z, ROADSIDE_CHECK)) return;
    map.fillCircle(p.x, p.z, CAR_RADIUS + 0.4);
    out.push(p);
  };

  for (const road of [...tile.roads].sort((a, b) => a.id - b.id)) {
    if (road.kind !== RoadKind.Residential && road.kind !== RoadKind.Service) continue;
    const rnd = rngFrom(road.id * 17 + 3);
    const pts = road.points;
    let next = 3 + rnd() * 6,
      along = 0,
      k = 0;
    for (let i = 2; i < pts.length; i += 2) {
      const ax = ox + pts[i - 2],
        az = oz + pts[i - 1],
        bx = ox + pts[i],
        bz = oz + pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 0.01) continue;
      const ux = (bx - ax) / len,
        uz = (bz - az) / len;
      while (along + len >= next) {
        const d = next - along;
        next += 6 + rnd() * 4;
        if (rnd() >= 0.25) continue;
        const side = rnd() < 0.5 ? 1 : -1;
        const off = road.width / 2 + 1.3;
        const x = ax + ux * d - uz * off * side,
          z = az + uz * d + ux * off * side;
        tryPlace({
          id: road.id * 1000 + k++,
          x,
          z,
          heading: side > 0 ? yawOf(ux, uz) : yawOf(-ux, -uz),
          kind: kindFor(rnd()),
        });
      }
      along += len;
    }
  }

  for (const lot of [...lots].sort((a, b) => a.id - b.id)) {
    const r = lot.ring;
    let inside = false;
    for (let i = 0; i < r.length && !inside; i += 2) inside = map.inTile(r[i], r[i + 1]);
    if (!inside) continue;
    const obb = orientedRect(r);
    const rnd = rngFrom(lot.id * 23 + 9);
    const vx = -obb.uz,
      vz = obb.ux;
    let k = 0;
    for (let a = -obb.halfLong + 1.4; a <= obb.halfLong - 1.4 && k < 30; a += 2.8) {
      for (let c = -obb.halfShort + 2.75; c <= obb.halfShort - 2.75 && k < 30; c += 5.5) {
        const x = obb.cx + obb.ux * a + vx * c,
          z = obb.cz + obb.uz * a + vz * c;
        if (!pointInRing(x, z, r) || rnd() < 0.35) continue; // nicht jeder Platz ist belegt
        // Raster ist dichter als MIN_SPACING; auf Parkplätzen gilt die Rastergröße
        if (!map.inTile(x, z) || !map.isFree(x, z, 1.0)) continue;
        map.fillCircle(x, z, 1.2);
        out.push({ id: lot.id * 1000 + k++, x, z, heading: yawOf(vx, vz), kind: kindFor(rnd()) });
      }
    }
  }
  return out;
}
