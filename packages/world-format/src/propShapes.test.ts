import { describe, expect, it } from 'vite-plus/test';
import { PROP_SHAPE_COUNT, PropShape, SHAPE_KIND, countShapes, propShape } from './propShapes.ts';
import { PROP_KIND_COUNT, PropKind, SignVariant } from './types.ts';

describe('Formen der Kleinobjekte', () => {
  it('Schild-Varianten bekommen eigene Formen', () => {
    expect(propShape(PropKind.Sign, SignVariant.Round)).toBe(PropShape.Sign);
    expect(propShape(PropKind.Sign, SignVariant.TrafficLight)).toBe(PropShape.TrafficLight);
    expect(propShape(PropKind.Sign, SignVariant.BusStop)).toBe(PropShape.BusStop);
    expect(propShape(PropKind.Sign, SignVariant.Triangle)).toBe(PropShape.SignTriangle);
    expect(propShape(PropKind.Sign, SignVariant.BlueSquare)).toBe(PropShape.SignBlue);
    expect(propShape(PropKind.Bush, 1)).toBe(PropShape.BushTall);
    expect(propShape(PropKind.Bush, 3)).toBe(PropShape.BushRound);
  });

  it('jede Form gehört zur Art, aus der sie entsteht; jede Art hat mindestens eine Form', () => {
    expect(SHAPE_KIND).toHaveLength(PROP_SHAPE_COUNT);
    const kinds = new Set<number>();
    for (let k = 0; k < PROP_KIND_COUNT; k++)
      for (const v of [0, 1, 2, 3, 4]) {
        expect(SHAPE_KIND[propShape(k, v)]).toBe(k);
        kinds.add(k);
      }
    expect(kinds.size).toBe(PROP_KIND_COUNT);
  });

  it('zählt verschiedene Formen (Draw Calls) einer Kachel', () => {
    expect(
      countShapes([
        { kind: PropKind.Bush, variant: 0 },
        { kind: PropKind.Bush, variant: 3 },
        { kind: PropKind.Bush, variant: 1 },
        { kind: PropKind.Sign, variant: 0 },
        { kind: PropKind.Sign, variant: 3 },
      ]),
    ).toBe(4);
  });
});
