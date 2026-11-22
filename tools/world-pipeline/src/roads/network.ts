import { RoadKind, clipPolylineToRect, type Road } from '@kandern/world-format';
import { roadAttributes, type RoadAttributes } from './attributes.ts';

export interface RawWay {
  id: number;
  nodes: number[];
  /** Weltkoordinaten je Knoten (flach), gleiche Länge wie nodes*2. */
  coords: number[];
  tags: Record<string, string>;
}

const KIND: Record<string, [RoadKind, number]> = {
  motorway: [RoadKind.Motorway, 11],
  trunk: [RoadKind.Primary, 9],
  primary: [RoadKind.Primary, 8],
  secondary: [RoadKind.Secondary, 7],
  tertiary: [RoadKind.Tertiary, 6.5],
  motorway_link: [RoadKind.Motorway, 6],
  trunk_link: [RoadKind.Primary, 6],
  primary_link: [RoadKind.Primary, 6],
  secondary_link: [RoadKind.Secondary, 6],
  tertiary_link: [RoadKind.Tertiary, 5.5],
  unclassified: [RoadKind.Residential, 5.5],
  residential: [RoadKind.Residential, 5.5],
  living_street: [RoadKind.Residential, 5],
  road: [RoadKind.Residential, 5],
  service: [RoadKind.Service, 3.5],
  track: [RoadKind.Track, 3],
  path: [RoadKind.Path, 1.6],
  bridleway: [RoadKind.Path, 2],
  cycleway: [RoadKind.Cycleway, 2.2],
  footway: [RoadKind.Footway, 1.8],
  pedestrian: [RoadKind.Footway, 5],
  steps: [RoadKind.Steps, 1.8],
};

/** Straßentyp und Breite; null = keine darstellbare Verkehrsfläche. */
export function roadKind(tags: Record<string, string>): { kind: RoadKind; width: number } | null {
  if (tags.railway) return { kind: RoadKind.Rail, width: 3 };
  if (tags.area === 'yes') return null;
  const k = KIND[tags.highway ?? ''];
  if (!k) return null;
  const w = parseFloat((tags.width ?? '').replace(',', '.'));
  const lanes = parseInt(tags.lanes ?? '', 10);
  let width = k[1];
  if (Number.isFinite(w) && w > 0.8 && w < 30) width = w;
  else if (Number.isFinite(lanes) && lanes > 0 && k[0] <= RoadKind.Residential) width = Math.max(width, lanes * 3.1);
  return { kind: k[0], width };
}

/** Synthetische Knoten-ID aus einer Schnittposition (cm-Raster) – identisch in beiden Nachbarkacheln. */
export function cutNodeId(x: number, z: number): number {
  const xq = Math.round(x * 100) + 2_000_000;
  const zq = Math.round(z * 100) + 2_000_000;
  return 4e15 + xq * 4_000_000 + zq;
}

export interface WayPiece {
  id: number;
  kind: RoadKind;
  width: number;
  coords: number[];
  startNode: number;
  endNode: number;
  name: string;
  bridge: boolean;
  tunnel: boolean;
  attrs: RoadAttributes;
}

/**
 * Teilt Wege an Kreuzungsknoten (Knoten, die in mehreren Wegen vorkommen), damit das Netz über
 * Endpunkte zusammenhängt. Stück-ID = Weg-ID * 1000 + Stücknummer (stabil).
 */
export function splitAtJunctions(
  ways: RawWay[],
  inSettlement: (x: number, z: number) => boolean = () => false,
): WayPiece[] {
  const usage = new Map<number, number>();
  for (const w of ways) for (const n of w.nodes) usage.set(n, (usage.get(n) ?? 0) + 1);
  const pieces: WayPiece[] = [];
  for (const w of [...ways].sort((a, b) => a.id - b.id)) {
    const rk = roadKind(w.tags);
    if (!rk) continue;
    let start = 0;
    let part = 0;
    for (let i = 1; i < w.nodes.length; i++) {
      const isLast = i === w.nodes.length - 1;
      if (!isLast && (usage.get(w.nodes[i]) ?? 0) < 2) continue;
      const coords = w.coords.slice(start * 2, i * 2 + 2);
      const mid = Math.floor(coords.length / 4) * 2;
      pieces.push({
        id: w.id * 1000 + part++,
        kind: rk.kind,
        width: rk.width,
        coords,
        startNode: w.nodes[start],
        endNode: w.nodes[i],
        name: w.tags.name ?? w.tags.ref ?? '',
        bridge: w.tags.bridge !== undefined && w.tags.bridge !== 'no',
        tunnel: w.tags.tunnel !== undefined && w.tags.tunnel !== 'no',
        attrs: roadAttributes(w.tags, rk.kind, inSettlement(coords[mid], coords[mid + 1])),
      });
      start = i;
    }
  }
  return pieces;
}

/** Herkunft eines Kachel-Teilstücks: Stück und ob es dessen Anfang/Ende enthält. */
export interface RoadPart {
  piece: WayPiece;
  atStart: boolean;
  atEnd: boolean;
}

/** Schneidet Stücke an Kacheln und liefert Straßen je Kachel (Kachel-lokale Koordinaten). */
export function roadsPerTile(
  pieces: WayPiece[],
  tileSize: number,
  includes: (tx: number, tz: number) => boolean,
  /** Optional: Herkunft je Kachel-Teilstück, gleicher Index wie die Straßen. */
  partsOut?: Map<string, RoadPart[]>,
): Map<string, Road[]> {
  const out = new Map<string, Road[]>();
  for (const p of pieces) {
    let minX = Infinity,
      minZ = Infinity,
      maxX = -Infinity,
      maxZ = -Infinity;
    for (let i = 0; i < p.coords.length; i += 2) {
      minX = Math.min(minX, p.coords[i]);
      maxX = Math.max(maxX, p.coords[i]);
      minZ = Math.min(minZ, p.coords[i + 1]);
      maxZ = Math.max(maxZ, p.coords[i + 1]);
    }
    for (let tz = Math.floor(minZ / tileSize); tz <= Math.floor(maxZ / tileSize); tz++) {
      for (let tx = Math.floor(minX / tileSize); tx <= Math.floor(maxX / tileSize); tx++) {
        if (!includes(tx, tz)) continue;
        const x0 = tx * tileSize,
          z0 = tz * tileSize;
        const parts = clipPolylineToRect(p.coords, x0, z0, x0 + tileSize, z0 + tileSize);
        parts.forEach((c, k) => {
          const pts = c.points;
          const n = pts.length;
          const startNode = c.startCut === -1 ? p.startNode : cutNodeId(pts[0], pts[1]);
          const endNode = c.endCut === -1 ? p.endNode : cutNodeId(pts[n - 2], pts[n - 1]);
          const local = new Float32Array(n);
          for (let i = 0; i < n; i += 2) {
            local[i] = pts[i] - x0;
            local[i + 1] = pts[i + 1] - z0;
          }
          const key = `${tx},${tz}`;
          let list = out.get(key);
          if (!list) out.set(key, (list = []));
          list.push({
            id: p.id + k / 100, // mehrere Teilstücke in derselben Kachel unterscheiden
            kind: p.kind,
            width: p.width,
            points: local,
            startNode,
            endNode,
            name: p.name,
            bridge: p.bridge,
            tunnel: p.tunnel,
          });
          if (partsOut) {
            let al = partsOut.get(key);
            if (!al) partsOut.set(key, (al = []));
            al.push({ piece: p, atStart: c.startCut === -1, atEnd: c.endCut === -1 });
          }
        });
      }
    }
  }
  return out;
}

/** Straßengraph über alle Kacheln; Knoten mit Weltposition (für Konnektivitätsprüfungen). */
export class RoadGraph {
  readonly adj = new Map<number, Set<number>>();
  readonly pos = new Map<number, [number, number]>();

  addTileRoads(
    tx: number,
    tz: number,
    tileSize: number,
    roads: Road[],
    filter: (r: Road) => boolean = () => true,
  ): void {
    for (const r of roads) {
      if (!filter(r)) continue;
      const n = r.points.length;
      this.link(r.startNode, r.endNode);
      this.pos.set(r.startNode, [tx * tileSize + r.points[0], tz * tileSize + r.points[1]]);
      this.pos.set(r.endNode, [tx * tileSize + r.points[n - 2], tz * tileSize + r.points[n - 1]]);
    }
  }

  private link(a: number, b: number): void {
    if (!this.adj.has(a)) this.adj.set(a, new Set());
    if (!this.adj.has(b)) this.adj.set(b, new Set());
    this.adj.get(a)!.add(b);
    this.adj.get(b)!.add(a);
  }

  nearest(x: number, z: number): number | null {
    let best: number | null = null,
      bd = Infinity;
    for (const [id, [px, pz]] of this.pos) {
      const d = (px - x) ** 2 + (pz - z) ** 2;
      if (d < bd) {
        bd = d;
        best = id;
      }
    }
    return best;
  }

  connected(a: number, b: number): boolean {
    const seen = new Set([a]);
    const queue = [a];
    while (queue.length) {
      const c = queue.pop()!;
      if (c === b) return true;
      for (const n of this.adj.get(c) ?? [])
        if (!seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
    }
    return false;
  }
}
