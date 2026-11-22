import { BuildingType, RoofShape, type Building, type Road } from '@kandern/world-format';
import { idRandom } from '../palette.ts';

/** Dachüberstand an Traufe und Ortgang (m). */
export const ROOF_OVERHANG = 0.5;
/** Anteil der Putz-/Fachwerkhäuser mit Fensterläden und der geneigten Dächer mit Schornstein. */
export const SHUTTER_SHARE = 0.5;
export const CHIMNEY_SHARE = 0.4;
/** Türen nur an Wänden ab dieser Länge (m); Straßen weiter weg als MAX_ROAD_DIST zählen nicht. */
const MIN_DOOR_WALL = 2.2;
const MAX_ROAD_DIST = 60;

export const enum ShutterColor {
  None = 0,
  Green = 1,
  Red = 2,
  Grey = 3,
}

export interface BuildingDetails {
  /** Index der Wand (Kante i -> i+1) mit Haustür oder null. */
  doorWall: number | null;
  shutters: ShutterColor;
  /** Schornstein in Koordinaten des orientierten Rechtecks: a = Anteil der halben Länge, c = Anteil der halben Breite. */
  chimney: { a: number; c: number } | null;
}

const WITH_DOOR = new Set([
  BuildingType.Residential,
  BuildingType.HalfTimbered,
  BuildingType.Farm,
  BuildingType.Commercial,
  BuildingType.Public,
  BuildingType.Church,
]);
const WITH_SHUTTERS = new Set([BuildingType.Residential, BuildingType.HalfTimbered]);
const WITH_CHIMNEY = new Set([
  BuildingType.Residential,
  BuildingType.HalfTimbered,
  BuildingType.Farm,
  BuildingType.Public,
]);
const SHUTTER_COLORS = [ShutterColor.Green, ShutterColor.Green, ShutterColor.Red, ShutterColor.Grey];

/** Nächster Punkt auf einer Straße (Fahrbahn bevorzugt) zu (x, z) und sein Abstand. */
function nearestRoadPoint(x: number, z: number, roads: Road[]): { x: number; z: number; d: number } | null {
  let best: { x: number; z: number; d: number } | null = null;
  for (const r of roads) {
    const p = r.points;
    for (let i = 2; i < p.length; i += 2) {
      const ax = p[i - 2],
        az = p[i - 1],
        dx = p[i] - ax,
        dz = p[i + 1] - az;
      const l2 = dx * dx + dz * dz;
      const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0;
      const qx = ax + dx * t,
        qz = az + dz * t;
      const d = Math.hypot(qx - x, qz - z);
      if (!best || d < best.d) best = { x: qx, z: qz, d };
    }
  }
  return best && best.d <= MAX_ROAD_DIST ? best : null;
}

/**
 * Wand mit Haustür: die Wand, deren Mitte der nächsten Straße am nächsten liegt und die ihr zugewandt ist
 * (Außennormale zeigt zur Straße). Ohne Straße in der Nähe: längste Wand.
 */
export function doorWall(outline: ArrayLike<number>, roads: Road[]): number | null {
  const n = outline.length / 2;
  let longest = -1,
    longestLen = 0,
    best = -1,
    bestD = Infinity;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const x0 = outline[i * 2],
      z0 = outline[i * 2 + 1],
      x1 = outline[j * 2],
      z1 = outline[j * 2 + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < MIN_DOOR_WALL) continue;
    if (len > longestLen) {
      longestLen = len;
      longest = i;
    }
    const mx = (x0 + x1) / 2,
      mz = (z0 + z1) / 2;
    const q = nearestRoadPoint(mx, mz, roads);
    if (!q) continue;
    const ox = (z1 - z0) / len,
      oz = -(x1 - x0) / len; // Außennormale bei CCW-Umlauf
    if ((q.x - mx) * ox + (q.z - mz) * oz <= 0) continue;
    if (q.d < bestD) {
      bestD = q.d;
      best = i;
    }
  }
  if (best >= 0) return best;
  return longest >= 0 ? longest : null;
}

/** Alle Details eines Gebäudes, deterministisch aus der Gebäude-ID (und den Straßen der Kachel). */
export function buildingDetails(b: Building, roads: Road[]): BuildingDetails {
  const shutters =
    WITH_SHUTTERS.has(b.type) && idRandom(b.id, 7) < SHUTTER_SHARE
      ? SHUTTER_COLORS[Math.floor(idRandom(b.id, 8) * SHUTTER_COLORS.length)]
      : ShutterColor.None;
  const pitched = b.roof === RoofShape.Gabled || b.roof === RoofShape.Hipped;
  const chimney =
    pitched && WITH_CHIMNEY.has(b.type) && idRandom(b.id, 9) < CHIMNEY_SHARE
      ? { a: (idRandom(b.id, 10) - 0.5) * 1.1, c: idRandom(b.id, 11) < 0.5 ? -0.4 : 0.4 }
      : null;
  return { doorWall: WITH_DOOR.has(b.type) ? doorWall(b.outline, roads) : null, shutters, chimney };
}
