import type { Roundabout } from '@kandern/world-format';
import type { GeoBuilder } from '../gen/GeoBuilder.ts';
import { Marking, RoadCode, encodeMarking } from './profile.ts';
import { ROAD_LIFT } from './ribbon.ts';

type V3 = [number, number, number];
const WHITE: [number, number, number] = [1, 1, 1];

/** Breite des überfahrbaren, gepflasterten Innenrings (m) und Höhen über der Fahrbahn. */
export const APRON_WIDTH = 1.5;
const APRON_HEIGHT = 0.05;
const ISLAND_HEIGHT = 0.25;
/** Ring liegt minimal über den Zufahrten (die bis unter den Ring reichen). */
const RING_LIFT = ROAD_LIFT + 0.05;

/** Querschnitt von innen nach außen: Abstand zur Mitte, Höhe, Code der Fläche bis zum nächsten Punkt. */
export function roundaboutRings(k: Roundabout): { rho: number; h: number; code: RoadCode }[] {
  const rIn = k.radius - k.width / 2,
    rOut = k.radius + k.width / 2;
  const rIsland = Math.max(0.5, rIn - APRON_WIDTH);
  return [
    { rho: rIsland, h: ISLAND_HEIGHT, code: RoadCode.Curb }, // Bordstein der Insel (senkrecht)
    { rho: rIsland, h: APRON_HEIGHT, code: RoadCode.Paving }, // Innenring
    { rho: rIn, h: APRON_HEIGHT, code: RoadCode.Curb }, // flacher Bordstein zum Ring
    { rho: rIn, h: 0, code: RoadCode.AsphaltMain }, // Fahrbahn
    { rho: rOut, h: 0, code: RoadCode.AsphaltMain },
  ];
}

/** Segmentzahl: etwa alle 2 m am Außenrand, mindestens 32 (rund statt eckig). */
export const segmentsFor = (k: Roundabout) => Math.max(32, Math.ceil((2 * Math.PI * (k.radius + k.width / 2)) / 2));

/**
 * Kreisverkehr als runder Ring: Fahrbahn mit Randlinien, Innenring aus Pflaster, erhöhte Rasen-Insel
 * mit Bordstein. Höhe je Winkel vom Gelände an der Fahrbahnmitte (folgt leichten Hängen).
 */
export function addRoundabout(g: GeoBuilder, k: Roundabout, ground: (x: number, z: number) => number): void {
  const n = segmentsFor(k);
  const rings = roundaboutRings(k);
  const marking = encodeMarking({ marking: Marking.Edges, lanes: 1, halfCarriageway: k.width / 2 });
  const angles = Array.from({ length: n + 1 }, (_, i) => (i / n) * Math.PI * 2);
  const base = angles.map((a) => ground(k.x + Math.cos(a) * k.radius, k.z + Math.sin(a) * k.radius) + RING_LIFT);
  const p = (i: number, rho: number, h: number): V3 => [
    k.x + Math.cos(angles[i]) * rho,
    base[i] + h,
    k.z + Math.sin(angles[i]) * rho,
  ];
  // Rasen-Insel als Fächer
  const top = rings[0];
  const cy = Math.max(...base) + top.h;
  for (let i = 0; i < n; i++) {
    g.tri(
      [k.x, cy, k.z],
      p(i, top.rho, top.h),
      p(i + 1, top.rho, top.h),
      [0, 1, 0],
      [WHITE, WHITE, WHITE],
      [
        [0, 0],
        [Math.cos(angles[i]) * top.rho, Math.sin(angles[i]) * top.rho],
        [Math.cos(angles[i + 1]) * top.rho, Math.sin(angles[i + 1]) * top.rho],
      ],
      [RoadCode.Grass, 0],
    );
  }
  // Ringflächen zwischen aufeinanderfolgenden Querschnittspunkten
  for (let r = 0; r < rings.length - 1; r++) {
    const a = rings[r],
      b = rings[r + 1];
    const vertical = a.rho === b.rho;
    for (let i = 0; i < n; i++) {
      const mid = (angles[i] + angles[i + 1]) / 2;
      // senkrechte Bordsteine zeigen nach außen, flache Ringe nach oben
      const out: V3 = vertical ? [Math.cos(mid), 0, Math.sin(mid)] : [0, 1, 0];
      const s0 = angles[i] * k.radius,
        s1 = angles[i + 1] * k.radius;
      // uv.x = Abstand zur Fahrbahnmitte (Randlinien bei ±(Breite/2 − 0,3)), uv.y = Bogenlänge
      g.quad(
        p(i, a.rho, a.h),
        p(i + 1, a.rho, a.h),
        p(i + 1, b.rho, b.h),
        p(i, b.rho, b.h),
        out,
        [WHITE, WHITE, WHITE, WHITE],
        [
          [a.rho - k.radius, s0],
          [a.rho - k.radius, s1],
          [b.rho - k.radius, s1],
          [b.rho - k.radius, s0],
        ],
        [a.code, marking],
      );
    }
  }
}
