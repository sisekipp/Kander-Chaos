import { VehicleKind } from '@kandern/world-format';

export type RGB = [number, number, number];

const hex = (h: number): RGB => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

/** Kindgerechte, kräftige Lackfarben je Fahrzeugart. */
export const PAINTS: Record<VehicleKind, RGB[]> = {
  [VehicleKind.Car]: [0xe8443a, 0x2f7de1, 0xf2c230, 0x3fb56a, 0xf08a24, 0x8e5ad6, 0xf4f1ea, 0x30b7c4, 0xe25c9b].map(
    hex,
  ),
  [VehicleKind.Motorbike]: [0xd8342c, 0x1f2f45, 0xf2c230, 0x2fa35c, 0xf08a24].map(hex),
  [VehicleKind.Bike]: [0x2f7de1, 0xe8443a, 0x3fb56a, 0xf2c230, 0xe25c9b, 0x30b7c4].map(hex),
};

/** Deterministische Lackfarbe aus der Parkpositions-ID (gleicher Ort -> gleiche Farbe). */
export function paintFor(kind: VehicleKind, id: number): RGB {
  let h = (Math.floor(id) ^ Math.floor(id / 4294967296)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = (h ^ (h >>> 16)) >>> 0;
  const list = PAINTS[kind];
  return list[h % list.length];
}

export const darken = (c: RGB, f: number): RGB => [c[0] * f, c[1] * f, c[2] * f];
