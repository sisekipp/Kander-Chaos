import { describe, expect, it } from 'vite-plus/test';
import { VehicleKind } from '@kandern/world-format';
import { restHeight } from './placement.ts';
import { VEHICLE_SPECS } from './specs.ts';

describe('Ruhehöhe', () => {
  it('Karosserie steht über dem Boden, Federn leicht eingefedert', () => {
    for (const k of [VehicleKind.Car, VehicleKind.Bike, VehicleKind.Motorbike] as const) {
      const s = VEHICLE_SPECS[k];
      const h = restHeight(s);
      expect(h - s.box[1] / 2).toBeGreaterThan(0.05); // Unterboden frei
      expect(h).toBeLessThan(s.suspension.rest - s.wheels[0].y); // eingefedert
    }
  });
});
