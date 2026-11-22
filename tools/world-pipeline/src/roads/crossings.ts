import { RoadKind, type Crossing } from '@kandern/world-format';
import type { WayPiece } from './network.ts';

/** Größter Abstand eines Übergangs-Knotens von der Straßenmitte, damit er zugeordnet wird (m). */
const MAX_SNAP = 4;

/** Fußgängerüberweg mit Zebrastreifen (in Deutschland oft `crossing=uncontrolled` + `crossing_ref=zebra`). */
export function isZebra(tags: Record<string, string>): boolean {
  if (tags.highway !== 'crossing') return false;
  const markings = tags['crossing:markings'];
  if (markings === 'zebra' || tags.crossing_ref === 'zebra' || tags.crossing === 'zebra') return true;
  if (markings === 'no' || tags.crossing === 'unmarked' || tags.crossing === 'traffic_signals') return false;
  return tags.crossing === 'marked' || tags.crossing === 'uncontrolled' || markings === 'yes';
}

const CARRIAGEWAY = (k: RoadKind) => k <= RoadKind.Service;

/**
 * Ordnet Zebrastreifen-Knoten der nächsten Fahrbahn zu: Mitte auf der Straßenachse,
 * Laufrichtung quer zur Straße, Länge = Fahrbahnbreite. Nicht zuordenbare Knoten entfallen.
 */
export function placeCrossings(points: { x: number; z: number }[], pieces: WayPiece[]): Crossing[] {
  const roads = pieces.filter((p) => CARRIAGEWAY(p.kind));
  const out: Crossing[] = [];
  for (const pt of points) {
    let best: Crossing | null = null;
    let bestD = MAX_SNAP;
    for (const r of roads) {
      const c = r.coords;
      for (let i = 2; i < c.length; i += 2) {
        const ax = c[i - 2],
          az = c[i - 1];
        const dx = c[i] - ax,
          dz = c[i + 1] - az;
        const l2 = dx * dx + dz * dz;
        if (l2 < 1e-6) continue;
        const t = Math.max(0, Math.min(1, ((pt.x - ax) * dx + (pt.z - az) * dz) / l2));
        const px = ax + dx * t,
          pz = az + dz * t;
        const d = Math.hypot(px - pt.x, pz - pt.z);
        if (d < bestD) {
          bestD = d;
          const l = Math.sqrt(l2);
          best = { x: px, z: pz, dirX: -dz / l, dirZ: dx / l, length: r.width };
        }
      }
    }
    if (best) out.push(best);
  }
  return out;
}
