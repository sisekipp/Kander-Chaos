/** Typen und Helfer für Overpass-JSON (`out body geom`). */

export interface LatLon {
  lat: number;
  lon: number;
}

export interface OsmNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

export interface OsmWay {
  type: 'way';
  id: number;
  nodes: number[];
  geometry: (LatLon | null)[];
  tags?: Record<string, string>;
}

export interface OsmMember {
  type: 'node' | 'way' | 'relation';
  ref: number;
  role: string;
  geometry?: (LatLon | null)[];
}

export interface OsmRelation {
  type: 'relation';
  id: number;
  members: OsmMember[];
  tags?: Record<string, string>;
}

export type OsmElement = OsmNode | OsmWay | OsmRelation;

export interface OverpassResult {
  osm3s?: { timestamp_osm_base?: string };
  elements: OsmElement[];
}

/** Stabile ID über Element-Typen hinweg (Spec: stabile Gebäude-ID). */
export const stableId = (el: { type: string; id: number }): number =>
  (el.type === 'node' ? 0 : el.type === 'way' ? 1 : 2) * 1e12 + el.id;

type Pt = [number, number];

/**
 * Setzt Multipolygon-Ringe aus Mitgliedswegen zusammen (Wege an gemeinsamen Endpunkten verketten).
 * `project` wandelt lat/lon in Meter um. Offene Reste werden verworfen.
 */
export function assembleRings(members: OsmMember[], role: 'outer' | 'inner', project: (p: LatLon) => Pt): Pt[][] {
  const segs: Pt[][] = [];
  for (const m of members) {
    if (m.type !== 'way' || !m.geometry) continue;
    if ((m.role || 'outer') !== role) continue;
    const pts = m.geometry.filter((g): g is LatLon => g !== null).map(project);
    if (pts.length >= 2) segs.push(pts);
  }
  const key = (p: Pt) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`;
  const rings: Pt[][] = [];
  const used: boolean[] = Array.from({ length: segs.length }, () => false);
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const ring = [...segs[i]];
    let guard = 0;
    while (key(ring[0]) !== key(ring[ring.length - 1]) && guard++ < segs.length) {
      const endK = key(ring[ring.length - 1]);
      let found = false;
      for (let j = 0; j < segs.length; j++) {
        if (used[j]) continue;
        const s = segs[j];
        if (key(s[0]) === endK) {
          ring.push(...s.slice(1));
          used[j] = true;
          found = true;
          break;
        }
        if (key(s[s.length - 1]) === endK) {
          ring.push(...[...s].reverse().slice(1));
          used[j] = true;
          found = true;
          break;
        }
      }
      if (!found) break;
    }
    if (ring.length >= 4 && key(ring[0]) === key(ring[ring.length - 1])) rings.push(ring.slice(0, -1));
  }
  return rings;
}

/** Geschlossener Weg -> Ring ohne Schlusspunkt (oder null). */
export function wayRing(w: OsmWay, project: (p: LatLon) => Pt): Pt[] | null {
  const pts = w.geometry.filter((g): g is LatLon => g !== null).map(project);
  if (pts.length < 4 || w.nodes[0] !== w.nodes[w.nodes.length - 1]) return null;
  return pts.slice(0, -1);
}
