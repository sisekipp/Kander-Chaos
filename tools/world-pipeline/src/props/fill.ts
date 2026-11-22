import { BuildingType, PropKind, RoadKind, LandKind, centroid, type TileData } from '@kandern/world-format';
import type { ConflictMap } from './conflicts.ts';
import { isSettled } from './land.ts';
import { rngFrom, yawOf } from './rng.ts';
import type { WorldProp } from './types.ts';

/**
 * Deterministische Ergänzung von Kleinobjekten je Kachel (Zufall aus Weg- bzw. Gebäude-ID).
 * Regeln:
 * - Laternen alle ~30 m entlang Wohn-/Neben-/Ortsstraßen im bebauten Umfeld, wechselseitig, Abstand Breite/2 + 1,6 m.
 * - Büsche: 1–3 je Wohn-/Fachwerk-/Hofgebäude, 2–5 m vor einer Wand.
 * - Zaunfelder (2,5 m) in Läufen von 3–8 Feldern am Wohnstraßenrand (Abstand Breite/2 + 2 m), ca. 40 % Abdeckung.
 * - Bank + Mülleimer an Spielplätzen/Bushaltestellen und in Parks.
 * Alles nur auf freien Stellen (ConflictMap) und innerhalb der Kachel.
 */
export interface FillInput {
  tile: TileData;
  map: ConflictMap;
  anchors: { x: number; z: number; kind: 'playground' | 'bus_stop' }[];
}

const LAMP_ROADS = new Set([RoadKind.Residential, RoadKind.Tertiary, RoadKind.Secondary, RoadKind.Service]);
const GARDEN_TYPES = new Set([BuildingType.Residential, BuildingType.HalfTimbered, BuildingType.Farm]);

export function fillProps({ tile, map, anchors }: FillInput): WorldProp[] {
  const out: WorldProp[] = [];
  const ox = tile.tx * tile.size,
    oz = tile.tz * tile.size;
  const place = (p: WorldProp, r: number, allowPath = false): boolean => {
    if (!map.inTile(p.x, p.z) || !map.isFree(p.x, p.z, r, allowPath)) return false;
    map.fillCircle(p.x, p.z, r + 0.3);
    out.push(p);
    return true;
  };

  // Laternen und Zäune entlang der Straßen
  for (const road of [...tile.roads].sort((a, b) => a.id - b.id)) {
    const rnd = rngFrom(road.id * 7 + 1);
    const pts = road.points;
    let dist = rnd() * 30,
      side = rnd() < 0.5 ? 1 : -1;
    let fenceRun = 0;
    for (let k = 2; k < pts.length; k += 2) {
      const ax = ox + pts[k - 2],
        az = oz + pts[k - 1],
        bx = ox + pts[k],
        bz = oz + pts[k + 1];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 0.01) continue;
      const ux = (bx - ax) / len,
        uz = (bz - az) / len,
        nx = -uz,
        nz = ux;
      for (let d = 0; d < len; d += 2.5) {
        const cx = ax + ux * d,
          cz = az + uz * d;
        const settled = isSettled(tile, cx - ox, cz - oz);
        if (LAMP_ROADS.has(road.kind) && settled && (dist += 2.5) >= 30) {
          dist = 0;
          const off = road.width / 2 + 1.6;
          if (
            place(
              {
                kind: PropKind.Lamp,
                x: cx + nx * off * side,
                z: cz + nz * off * side,
                rot: yawOf(-nx * side, -nz * side),
                variant: 0,
              },
              0.3,
              true,
            )
          )
            side = -side;
        }
        if (road.kind === RoadKind.Residential && settled) {
          if (fenceRun === 0 && rnd() < 0.07) fenceRun = 3 + Math.floor(rnd() * 6);
          if (fenceRun > 0) {
            fenceRun--;
            const off = road.width / 2 + 2;
            const s = rnd() < 0.5 ? 1 : -1;
            place(
              { kind: PropKind.Fence, x: cx + nx * off * s, z: cz + nz * off * s, rot: yawOf(ux, uz), variant: 0 },
              0.5,
            );
          }
        }
      }
    }
  }

  // Büsche in Gärten
  for (const b of [...tile.buildings].sort((p, q) => p.id - q.id)) {
    if (!GARDEN_TYPES.has(b.type)) continue;
    const rnd = rngFrom(b.id * 13 + 5);
    const [cx, cz] = centroid(b.outline);
    const n = 1 + Math.floor(rnd() * 3);
    const o = b.outline,
      cnt = o.length / 2;
    for (let i = 0; i < n; i++) {
      const e = Math.floor(rnd() * cnt),
        f = (e + 1) % cnt;
      const mx = (o[e * 2] + o[f * 2]) / 2,
        mz = (o[e * 2 + 1] + o[f * 2 + 1]) / 2;
      let dx = mx - cx,
        dz = mz - cz;
      const l = Math.hypot(dx, dz) || 1;
      dx /= l;
      dz /= l;
      const d = 2 + rnd() * 3;
      place(
        {
          kind: PropKind.Bush,
          x: ox + mx + dx * d,
          z: oz + mz + dz * d,
          rot: rnd() * Math.PI * 2,
          variant: Math.floor(rnd() * 3),
        },
        0.8,
      );
    }
  }

  // Bänke und Mülleimer an Ankerpunkten und in Parks
  const parkAnchors = tile.land
    .filter((a) => a.kind === LandKind.Park)
    .map((a) => {
      const [x, z] = centroid(a.rings[0]);
      return { x: ox + x, z: oz + z, kind: 'playground' as const };
    });
  for (const [i, a] of [...anchors, ...parkAnchors].entries()) {
    const rnd = rngFrom(Math.round(a.x * 10) * 31 + Math.round(a.z * 10) + i);
    const ang = rnd() * Math.PI * 2;
    place(
      { kind: PropKind.Bench, x: a.x + Math.cos(ang) * 2.5, z: a.z + Math.sin(ang) * 2.5, rot: ang, variant: 0 },
      1,
      true,
    );
    place(
      {
        kind: PropKind.Bin,
        x: a.x + Math.cos(ang + 0.9) * 2.8,
        z: a.z + Math.sin(ang + 0.9) * 2.8,
        rot: 0,
        variant: 0,
      },
      0.4,
      true,
    );
  }
  return out;
}
