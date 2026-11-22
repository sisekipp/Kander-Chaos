import { idRandom } from '../world/gen/palette.ts';

export type RGB = [number, number, number];

const hex = (h: number): RGB => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

/**
 * Lackfarben der Spielpalette: kräftig, aber nicht grell (stilisierter Look), dazu typische Alltagsfarben
 * (Silber, Weiß, Dunkelgrau, Dunkelblau), damit ein Parkplatz nicht wie ein Bonbonglas aussieht.
 */
export const CAR_PAINTS: RGB[] = [
  0xd8d8d4, 0xf1f1ee, 0x4a4f57, 0x2f4d7a, 0x8c1d1d, 0xc0392b, 0x2e7d4f, 0x1f5f8b, 0xe2b13c, 0x6b8e9e, 0xa0a4a8,
  0x7a4b2a,
].map(hex);

/** Deterministische Wahl aus einer Liste je ID (gleiche ID -> gleiches Ergebnis, auch nach Neustart). */
export function pickFor<T>(id: number, list: T[], salt = 0): T {
  return list[Math.min(list.length - 1, Math.floor(idRandom(id, salt) * list.length))];
}

/** Lackfarbe eines Fahrzeugs aus seiner ID. */
export function paintFor(id: number, palette: RGB[] = CAR_PAINTS): RGB {
  return pickFor(id, palette, 31);
}
