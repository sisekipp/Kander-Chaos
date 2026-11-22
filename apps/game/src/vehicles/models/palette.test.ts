import { describe, expect, it } from 'vite-plus/test';
import { VehicleKind } from '@kandern/world-format';
import { PAINTS, paintFor } from './palette.ts';

describe('Lackfarben', () => {
  it('sind deterministisch aus der ID und stammen aus der Palette der Art', () => {
    expect(paintFor(VehicleKind.Car, 4e12 + 17)).toEqual(paintFor(VehicleKind.Car, 4e12 + 17));
    expect(PAINTS[VehicleKind.Bike]).toContainEqual(paintFor(VehicleKind.Bike, 123456789012));
  });

  it('verteilen sich über die Palette', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(paintFor(VehicleKind.Car, 1e12 + i * 1000).join());
    expect(seen.size).toBe(PAINTS[VehicleKind.Car].length);
  });
});
