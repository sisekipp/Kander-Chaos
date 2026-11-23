import type { RGB } from '../assets/palette.ts';

/** Wählbare Varianten der Spielfigur: Farben der Zonen `shirt`, `pants`, `hair` im Modell `figure-kid`. */
export interface FigureVariant {
  name: string;
  shirt: RGB;
  pants: RGB;
  hair: RGB;
}

export const FIGURE_VARIANTS: readonly FigureVariant[] = [
  { name: 'Orange', shirt: [0.95, 0.45, 0.2], pants: [0.2, 0.32, 0.6], hair: [0.35, 0.22, 0.12] },
  { name: 'Grün', shirt: [0.3, 0.72, 0.35], pants: [0.25, 0.25, 0.28], hair: [0.85, 0.7, 0.35] },
  { name: 'Lila', shirt: [0.6, 0.35, 0.8], pants: [0.15, 0.2, 0.35], hair: [0.12, 0.1, 0.09] },
  { name: 'Rot', shirt: [0.9, 0.2, 0.22], pants: [0.45, 0.35, 0.25], hair: [0.75, 0.35, 0.15] },
  { name: 'Gelb', shirt: [0.98, 0.82, 0.2], pants: [0.2, 0.45, 0.55], hair: [0.25, 0.16, 0.1] },
  { name: 'Blau', shirt: [0.25, 0.55, 0.95], pants: [0.9, 0.9, 0.88], hair: [0.55, 0.38, 0.2] },
];

/** Gültige Varianten-Nummer (unbekannte Werte -> 0). */
export function normalizeVariant(v: unknown): number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < FIGURE_VARIANTS.length ? v : 0;
}

export const variantColors = (v: number): FigureVariant => FIGURE_VARIANTS[normalizeVariant(v)];
