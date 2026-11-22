import {
  LandKind,
  clipPolylineToRect,
  clipRingToRect,
  ensureCCW,
  ensureCW,
  signedArea,
  type LandArea,
  type Waterway,
} from '@kandern/world-format';

/** OSM-Tags -> Landnutzungsart (null = nicht relevant). */
export function landKind(tags: Record<string, string>): LandKind | null {
  const lu = tags.landuse,
    nat = tags.natural,
    lei = tags.leisure;
  if (lu === 'forest' || nat === 'wood') {
    const leaf = tags.leaf_type;
    if (leaf === 'broadleaved') return LandKind.ForestDeciduous;
    if (leaf === 'needleleaved') return LandKind.ForestConiferous;
    return LandKind.ForestMixed;
  }
  if (nat === 'water' || lu === 'reservoir' || lu === 'basin') return LandKind.Water;
  switch (lu) {
    case 'meadow':
    case 'grass':
    case 'village_green':
    case 'recreation_ground':
      return LandKind.Meadow;
    case 'farmland':
    case 'greenhouse_horticulture':
    case 'plant_nursery':
      return LandKind.Farmland;
    case 'orchard':
      return LandKind.Orchard;
    case 'vineyard':
      return LandKind.Vineyard;
    case 'residential':
    case 'farmyard':
      return LandKind.Residential;
    case 'commercial':
    case 'retail':
      return LandKind.Commercial;
    case 'industrial':
    case 'quarry':
    case 'railway':
      return LandKind.Industrial;
    case 'cemetery':
      return LandKind.Cemetery;
    case 'allotments':
      return LandKind.Park;
  }
  if (nat === 'grassland' || nat === 'heath' || nat === 'scrub') return LandKind.Meadow;
  if (lei === 'park' || lei === 'garden' || lei === 'playground') return LandKind.Park;
  if (lei === 'pitch' || lei === 'sports_centre') return LandKind.Sports;
  return null;
}

export interface RawArea {
  id: number;
  kind: LandKind;
  outers: number[][];
  inners: number[][];
}

/** Schneidet Flächen auf Kacheln zu. Ring 0 = außen (CCW), weitere = Löcher (CW). */
export function landPerTile(
  areas: RawArea[],
  tileSize: number,
  includes: (tx: number, tz: number) => boolean,
): Map<string, LandArea[]> {
  const out = new Map<string, LandArea[]>();
  for (const a of [...areas].sort((p, q) => p.id - q.id)) {
    for (const outer of a.outers) {
      let minX = Infinity,
        minZ = Infinity,
        maxX = -Infinity,
        maxZ = -Infinity;
      for (let i = 0; i < outer.length; i += 2) {
        minX = Math.min(minX, outer[i]);
        maxX = Math.max(maxX, outer[i]);
        minZ = Math.min(minZ, outer[i + 1]);
        maxZ = Math.max(maxZ, outer[i + 1]);
      }
      for (let tz = Math.floor(minZ / tileSize); tz <= Math.floor(maxZ / tileSize); tz++) {
        for (let tx = Math.floor(minX / tileSize); tx <= Math.floor(maxX / tileSize); tx++) {
          if (!includes(tx, tz)) continue;
          const x0 = tx * tileSize,
            z0 = tz * tileSize,
            x1 = x0 + tileSize,
            z1 = z0 + tileSize;
          const clipped = clipRingToRect(outer, x0, z0, x1, z1);
          if (clipped.length < 6 || Math.abs(signedArea(clipped)) < 1) continue;
          const rings = [ensureCCW(clipped)];
          for (const inner of a.inners) {
            const ci = clipRingToRect(inner, x0, z0, x1, z1);
            if (ci.length >= 6 && Math.abs(signedArea(ci)) >= 1) rings.push(ensureCW(ci));
          }
          const key = `${tx},${tz}`;
          let list = out.get(key);
          if (!list) out.set(key, (list = []));
          list.push({
            kind: a.kind,
            rings: rings.map((r) => {
              const f = new Float32Array(r.length);
              for (let i = 0; i < r.length; i += 2) {
                f[i] = r[i] - x0;
                f[i + 1] = r[i + 1] - z0;
              }
              return f;
            }),
          });
        }
      }
    }
  }
  return out;
}

export interface RawWaterway {
  id: number;
  kind: Waterway['kind'];
  width: number;
  name: string;
  coords: number[];
}

export function waterwayKind(tags: Record<string, string>): { kind: Waterway['kind']; width: number } | null {
  const w = parseFloat((tags.width ?? '').replace(',', '.'));
  switch (tags.waterway) {
    case 'river':
    case 'canal':
      return { kind: 'river', width: Number.isFinite(w) ? w : 8 };
    case 'stream':
      return { kind: 'stream', width: Number.isFinite(w) ? w : 2 };
    case 'ditch':
    case 'drain':
      return { kind: 'ditch', width: Number.isFinite(w) ? w : 1 };
    default:
      return null;
  }
}

export function waterwaysPerTile(
  ways: RawWaterway[],
  tileSize: number,
  includes: (tx: number, tz: number) => boolean,
): Map<string, Waterway[]> {
  const out = new Map<string, Waterway[]>();
  for (const w of [...ways].sort((a, b) => a.id - b.id)) {
    let minX = Infinity,
      minZ = Infinity,
      maxX = -Infinity,
      maxZ = -Infinity;
    for (let i = 0; i < w.coords.length; i += 2) {
      minX = Math.min(minX, w.coords[i]);
      maxX = Math.max(maxX, w.coords[i]);
      minZ = Math.min(minZ, w.coords[i + 1]);
      maxZ = Math.max(maxZ, w.coords[i + 1]);
    }
    for (let tz = Math.floor(minZ / tileSize); tz <= Math.floor(maxZ / tileSize); tz++) {
      for (let tx = Math.floor(minX / tileSize); tx <= Math.floor(maxX / tileSize); tx++) {
        if (!includes(tx, tz)) continue;
        const x0 = tx * tileSize,
          z0 = tz * tileSize;
        for (const c of clipPolylineToRect(w.coords, x0, z0, x0 + tileSize, z0 + tileSize)) {
          const pts = new Float32Array(c.points.length);
          for (let i = 0; i < pts.length; i += 2) {
            pts[i] = c.points[i] - x0;
            pts[i + 1] = c.points[i + 1] - z0;
          }
          const key = `${tx},${tz}`;
          let list = out.get(key);
          if (!list) out.set(key, (list = []));
          list.push({ kind: w.kind, width: w.width, name: w.name, points: pts });
        }
      }
    }
  }
  return out;
}
