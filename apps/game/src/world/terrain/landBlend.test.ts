import { describe, expect, it } from 'vite-plus/test';
import { LandKind } from '@kandern/world-format';
import { LandLookup } from '../gen/landLookup.ts';
import { LAND_COLORS } from '../gen/palette.ts';
import { fieldAngle, sampleLand } from './landBlend.ts';

const rect = (x0: number, z0: number, x1: number, z1: number) => new Float32Array([x0, z0, x1, z0, x1, z1, x0, z1]);

describe('weiche Übergänge der Landnutzung', () => {
  // Acker links (x < 100), Wiese rechts
  const land = new LandLookup([
    { kind: LandKind.Farmland, rings: [rect(0, 0, 100, 250)] },
    { kind: LandKind.Meadow, rings: [rect(100, 0, 250, 250)] },
  ]);
  const cache = new Map<number, number>();

  it('im Feldinneren reine Ackerfarbe und volles Furchengewicht', () => {
    const s = sampleLand(land, 50, 100, 250, cache);
    expect(s.color[0]).toBeCloseTo(LAND_COLORS[LandKind.Farmland][0]);
    expect(s.farm).toBe(1);
  });

  it('an der Grenze gemischte Farbe und abfallendes Furchengewicht', () => {
    const edge = sampleLand(land, 99, 100, 250, cache);
    const farm = LAND_COLORS[LandKind.Farmland][0],
      meadow = LAND_COLORS[LandKind.Meadow][0];
    expect(edge.color[0]).toBeLessThan(Math.max(farm, meadow) - 1e-3);
    expect(edge.color[0]).toBeGreaterThan(Math.min(farm, meadow) + 1e-3);
    expect(edge.farm).toBeGreaterThan(0.5);
    expect(edge.farm).toBeLessThan(1);
    // knapp außerhalb noch > 0 (stetig), weit außerhalb 0
    const outside = sampleLand(land, 101, 100, 250, cache).farm;
    expect(outside).toBeGreaterThan(0);
    expect(outside).toBeLessThan(0.5);
    expect(sampleLand(land, 110, 100, 250, cache).farm).toBe(0);
  });

  it('Farbe ändert sich über die Grenze stetig (kein harter Sprung)', () => {
    let prev = sampleLand(land, 93, 100, 250, cache).color[0];
    for (let x = 93.5; x <= 107; x += 0.5) {
      const c = sampleLand(land, x, 100, 250, cache).color[0];
      // höchstens zwei von neun Proben wechseln je Meter -> kleiner Sprung
      expect(Math.abs(c - prev)).toBeLessThan(0.06);
      prev = c;
    }
  });

  it('zwei Felder: Furchen fallen am Feldrand ab, auch bei gleicher Nutzung', () => {
    const two = new LandLookup([
      { kind: LandKind.Farmland, rings: [rect(0, 0, 100, 250)] },
      { kind: LandKind.Farmland, rings: [rect(100, 0, 250, 250)] },
    ]);
    expect(sampleLand(two, 99, 100, 250, new Map()).farm).toBeLessThan(1);
  });

  it('Furchenrichtung folgt der längsten echten Feldkante, Kachelrand zählt nicht', () => {
    // Feld 60 m breit (x), am Kachelrand z = 250 abgeschnitten -> echte lange Kante liegt bei x = 0 bzw. 60
    expect(fieldAngle(rect(0, 100, 60, 250), 250)).toBeCloseTo(Math.PI / 2);
    expect(fieldAngle(rect(20, 20, 200, 60), 250)).toBeCloseTo(0);
  });
});
