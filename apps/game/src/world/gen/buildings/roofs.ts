import { RoofShape, type Building, type orientedRect } from '@kandern/world-format';
import type { GeoBuilder } from '../GeoBuilder.ts';
import { Facade, type RGB } from '../palette.ts';
import { addBox, shade, type V3 } from './walls.ts';
import { ROOF_OVERHANG } from './details.ts';

/**
 * Sattel-, Walm-, Zelt- oder Pultdach über dem orientierten Rechteck mit Überstand (ROOF_OVERHANG);
 * Giebeldreiecke unter dem Dach in Wandfarbe, optional ein Schornstein (Koordinaten im Rechteck).
 */
export function addPitchedRoof(
  g: GeoBuilder,
  b: Building,
  obb: ReturnType<typeof orientedRect>,
  top: number,
  rc: RGB,
  wall: RGB,
  levelH: number,
  chimney: { a: number; c: number } | null = null,
): void {
  const ov = ROOF_OVERHANG;
  const L = obb.halfLong + ov,
    S = obb.halfShort + ov;
  const ux = obb.ux,
    uz = obb.uz,
    vx = -uz,
    vz = ux; // v = quer zur langen Achse
  const P = (a: number, c: number, y: number): V3 => [obb.cx + ux * a + vx * c, y, obb.cz + uz * a + vz * c];
  const ridgeY = top + b.roofHeight;
  // Traufe so tief, dass die Dachfläche genau über der Wandkante liegt (kein Spalt unter dem Dach)
  const eaveY = top - (b.roofHeight * ov) / S;
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
  if (chimney && (b.roof === RoofShape.Gabled || b.roof === RoofShape.Hipped)) {
    const a = chimney.a * obb.halfLong,
      c = chimney.c * obb.halfShort;
    const roofY = eaveY + (ridgeY - eaveY) * (1 - Math.abs(c) / S);
    const [cx, , cz] = P(a, c, 0);
    addBox(g, cx, cz, ux, uz, 0.3, 0.3, roofY - 0.4, ridgeY + 0.7, [0.62, 0.36, 0.3], [Facade.Plain, 1]);
  }
}
