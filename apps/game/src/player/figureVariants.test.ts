import { describe, expect, it } from 'vite-plus/test';
import { FIGURE_VARIANTS, normalizeVariant, variantColors } from './figureVariants.ts';

describe('Figurvarianten', () => {
  it('mindestens 4 Varianten mit unterschiedlichen Farben', () => {
    expect(FIGURE_VARIANTS.length).toBeGreaterThanOrEqual(4);
    const shirts = new Set(FIGURE_VARIANTS.map((v) => v.shirt.join()));
    expect(shirts.size).toBe(FIGURE_VARIANTS.length);
  });

  it('unbekannte Werte werden zur Standardvariante', () => {
    expect(normalizeVariant(2)).toBe(2);
    expect(normalizeVariant(-1)).toBe(0);
    expect(normalizeVariant(99)).toBe(0);
    expect(normalizeVariant(1.5)).toBe(0);
    expect(normalizeVariant('3')).toBe(0);
    expect(variantColors(99)).toBe(FIGURE_VARIANTS[0]);
  });
});
