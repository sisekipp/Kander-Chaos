import earcut from 'earcut';
import {
  BuildingType,
  RoofShape,
  orientedRect,
  sampleHeight,
  type Building,
  type TileData,
} from '@kandern/world-format';
import { GeoBuilder, type GeometryBuffers } from './GeoBuilder.ts';
import { FACADE_OF, Facade, ROOF_COLORS, WALL_COLORS, idRandom, pick, type RGB } from './palette.ts';

type V3 = [number, number, number];
const UP: V3 = [0, 1, 0];

export interface BuildingGenOptions {
  /** true = vereinfachte Blöcke für Ring 1 (flache Kappe, keine Dachform). */
  simple: boolean;
}

const shade = (c: RGB, f: number): RGB => [c[0] * f, c[1] * f, c[2] * f];

function roofColor(b: Building): RGB {
  const r = idRandom(b.id, 5);
  if (b.roof === RoofShape.Flat) return pick(ROOF_COLORS.flat, r);
  if (b.type === BuildingType.Industrial || b.type === BuildingType.Garage) return pick(ROOF_COLORS.metal, r);
  if (b.type === BuildingType.Church || r < 0.12) return pick(ROOF_COLORS.dark, r);
  return pick(ROOF_COLORS.tile, r);
}

/**
 * Erzeugt alle Gebäude einer Kachel als ein Mesh (Kachel-lokal). Wände folgen dem echten Grundriss;
 * Sattel-, Walm-, Zelt- und Pultdächer werden über dem orientierten Rechteck gebaut, wenn der
 * Grundriss annähernd rechteckig ist (Füllgrad ≥ 0,8), sonst Flachdach.
 */
export function buildBuildings(tile: TileData, opts: BuildingGenOptions): GeometryBuffers | null {
  const g = new GeoBuilder(true);
  const lod = tile.lods[0];
  const ground = (x: number, z: number) =>
    sampleHeight(tile, lod, Math.min(tile.size, Math.max(0, x)), Math.min(tile.size, Math.max(0, z)));
  for (const b of tile.buildings) addBuilding(g, b, ground, opts);
  return g.build();
}

export function addBuilding(
  g: GeoBuilder,
  b: Building,
  ground: (x: number, z: number) => number,
  opts: BuildingGenOptions,
): void {
  const o = b.outline;
  const n = o.length / 2;
  if (n < 3) return;
  let gMin = Infinity;
  for (let i = 0; i < n; i++) gMin = Math.min(gMin, ground(o[i * 2], o[i * 2 + 1]));
  const base = gMin - 0.6; // leicht eingesunken -> kein Schweben am Hang
  const top = gMin + b.wallHeight;
  const wall = pick(WALL_COLORS[b.type], idRandom(b.id, 1));
  const facade = opts.simple ? Facade.Plain : FACADE_OF[b.type];
  const levelH = b.wallHeight / Math.max(1, b.levels);
  const uv2: [number, number] = [facade, levelH];
  const bottomCol = shade(wall, 0.62); // eingebackene Umgebungsverdeckung am Boden
  const topCol = wall;

  // Wände
  let u = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const x0 = o[i * 2],
      z0 = o[i * 2 + 1],
      x1 = o[j * 2],
      z1 = o[j * 2 + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 0.05) continue;
    // Außennormale: rechts der Kante bei CCW-Umlauf
    const out: V3 = [(z1 - z0) / len, 0, -(x1 - x0) / len];
    const vb = base - gMin,
      vt = top - gMin;
    g.quad(
      [x0, base, z0],
      [x1, base, z1],
      [x1, top, z1],
      [x0, top, z0],
      out,
      [bottomCol, bottomCol, topCol, topCol],
      [
        [u, vb],
        [u + len, vb],
        [u + len, vt],
        [u, vt],
      ],
      uv2,
    );
    u += len;
  }

  const rc = roofColor(b);
  const obb = orientedRect(o);
  const pitched = !opts.simple && b.roof !== RoofShape.Flat && b.roofHeight > 0.2 && obb.fill >= 0.8;
  if (!pitched) {
    flatCap(
      g,
      o,
      opts.simple ? top + b.roofHeight * 0.4 : top,
      b.roof === RoofShape.Flat || opts.simple ? rc : shade(rc, 0.8),
      opts.simple ? top : null,
      wall,
      levelH,
    );
    return;
  }

  // Dach über dem orientierten Rechteck mit 0,35 m Überstand
  const ov = 0.35;
  const L = obb.halfLong + ov,
    S = obb.halfShort + ov;
  const ux = obb.ux,
    uz = obb.uz,
    vx = -uz,
    vz = ux; // v = quer zur langen Achse
  const P = (a: number, c: number, y: number): V3 => [obb.cx + ux * a + vx * c, y, obb.cz + uz * a + vz * c];
  const ridgeY = top + b.roofHeight;
  const eaveY = top - 0.15;
  const roofUv2: [number, number] = [Facade.RoofTile, 0];
  const rcDark = shade(rc, 0.82);
  const uvs = (w: number, hgt: number): [[number, number], [number, number], [number, number], [number, number]] => [
    [0, 0],
    [w, 0],
    [w, hgt],
    [0, hgt],
  ];
  const slope = Math.hypot(S, b.roofHeight);

  // Giebel-/Dreiecksflächen unter dem Dach in Wandfarbe schließen (Wand reicht nur bis Traufe)
  const gable = (a: number) => {
    const out: V3 = [ux * Math.sign(a), 0, uz * Math.sign(a)];
    g.tri(
      P(a, -obb.halfShort, top),
      P(a, obb.halfShort, top),
      P(a, 0, ridgeY - 0.2),
      out,
      [wall, wall, wall],
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      [Facade.Plain, levelH],
    );
  };

  switch (b.roof) {
    case RoofShape.Gabled: {
      for (const side of [-1, 1]) {
        const out: V3 = [vx * side * 0.7, 0.7, vz * side * 0.7];
        g.quad(
          P(-L, side * S, eaveY),
          P(L, side * S, eaveY),
          P(L, 0, ridgeY),
          P(-L, 0, ridgeY),
          out,
          [rcDark, rcDark, rc, rc],
          uvs(2 * L, slope),
          roofUv2,
        );
      }
      gable(-obb.halfLong);
      gable(obb.halfLong);
      break;
    }
    case RoofShape.Hipped: {
      const r = Math.max(0, L - S); // halbe Firstlänge
      for (const side of [-1, 1]) {
        const out: V3 = [vx * side * 0.7, 0.7, vz * side * 0.7];
        g.quad(
          P(-L, side * S, eaveY),
          P(L, side * S, eaveY),
          P(r, 0, ridgeY),
          P(-r, 0, ridgeY),
          out,
          [rcDark, rcDark, rc, rc],
          uvs(2 * L, slope),
          roofUv2,
        );
        const outEnd: V3 = [ux * side * 0.7, 0.7, uz * side * 0.7];
        g.tri(
          P(side * L, -S, eaveY),
          P(side * L, S, eaveY),
          P(side * r, 0, ridgeY),
          outEnd,
          [rcDark, rcDark, rc],
          [
            [0, 0],
            [2 * S, 0],
            [S, slope],
          ],
          roofUv2,
        );
      }
      break;
    }
    case RoofShape.Pyramidal: {
      const apex = P(0, 0, ridgeY);
      const corners: V3[] = [P(-L, -S, eaveY), P(L, -S, eaveY), P(L, S, eaveY), P(-L, S, eaveY)];
      for (let k = 0; k < 4; k++) {
        const a = corners[k],
          c = corners[(k + 1) % 4];
        const mid: V3 = [(a[0] + c[0]) / 2 - obb.cx, 0.8, (a[2] + c[2]) / 2 - obb.cz];
        g.tri(
          a,
          c,
          apex,
          mid,
          [rcDark, rcDark, rc],
          [
            [0, 0],
            [1, 0],
            [0.5, 1],
          ],
          roofUv2,
        );
      }
      break;
    }
    case RoofShape.Skillion: {
      const out: V3 = [vx * -0.3, 1, vz * -0.3];
      g.quad(
        P(-L, -S, eaveY),
        P(L, -S, eaveY),
        P(L, S, ridgeY),
        P(-L, S, ridgeY),
        out,
        [rc, rc, rc, rc],
        uvs(2 * L, 2 * S),
        roofUv2,
      );
      // Seitliche Dreiecke
      for (const side of [-1, 1]) {
        const outS: V3 = [ux * side, 0, uz * side];
        g.tri(
          P(side * obb.halfLong, -obb.halfShort, top),
          P(side * obb.halfLong, obb.halfShort, top),
          P(side * obb.halfLong, obb.halfShort, ridgeY),
          outS,
          [wall, wall, wall],
          [
            [0, 0],
            [1, 0],
            [1, 1],
          ],
          [Facade.Plain, levelH],
        );
      }
      break;
    }
  }
}

/** Flache Dachkappe per Triangulierung; optional mit Seitenwänden bis `wallFrom` (vereinfachte Blöcke). */
function flatCap(
  g: GeoBuilder,
  o: Float32Array,
  y: number,
  color: RGB,
  wallFrom: number | null,
  wall: RGB,
  levelH: number,
): void {
  const flat: number[] = Array.from(o);
  const tris = earcut(flat);
  for (let k = 0; k < tris.length; k += 3) {
    const a = tris[k],
      b = tris[k + 1],
      c = tris[k + 2];
    g.tri(
      [o[a * 2], y, o[a * 2 + 1]],
      [o[b * 2], y, o[b * 2 + 1]],
      [o[c * 2], y, o[c * 2 + 1]],
      UP,
      [color, color, color],
      [
        [o[a * 2], o[a * 2 + 1]],
        [o[b * 2], o[b * 2 + 1]],
        [o[c * 2], o[c * 2 + 1]],
      ],
      [Facade.RoofFlat, 0],
    );
  }
  if (wallFrom !== null && y - wallFrom > 0.05) {
    const n = o.length / 2;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const x0 = o[i * 2],
        z0 = o[i * 2 + 1],
        x1 = o[j * 2],
        z1 = o[j * 2 + 1];
      const len = Math.hypot(x1 - x0, z1 - z0);
      if (len < 0.05) continue;
      const out: V3 = [(z1 - z0) / len, 0, -(x1 - x0) / len];
      g.quad(
        [x0, wallFrom, z0],
        [x1, wallFrom, z1],
        [x1, y, z1],
        [x0, y, z0],
        out,
        [wall, wall, wall, wall],
        undefined,
        [Facade.Plain, levelH],
      );
    }
  }
}
