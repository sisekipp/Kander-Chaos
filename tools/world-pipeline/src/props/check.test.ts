import { describe, expect, it } from 'vite-plus/test';
import { PropKind, VehicleKind, type WorldIndex } from '@kandern/world-format';
import { checkProps } from './check.ts';
import { propTile } from './testFixtures.ts';

const index = { spawn: { x: 100, z: 100 } } as WorldIndex;

describe('Props-Prüfung', () => {
  it('schlägt fehl ohne Kleinobjekte', () => {
    expect(checkProps(index, [propTile()]).ok).toBe(false);
  });

  it('verlangt ≥ 10 Parkpositionen und ≥ 3 Prop-Arten um den Startpunkt', () => {
    const t = propTile();
    t.props = [PropKind.Lamp, PropKind.Bush, PropKind.Bin].map((kind, i) => ({
      kind,
      x: 100 + i,
      z: 120,
      rot: 0,
      variant: 0,
    }));
    t.parking = Array.from({ length: 10 }, (_, i) => ({
      id: i,
      x: 60 + i * 7,
      z: 60,
      heading: 0,
      kind: VehicleKind.Car,
    }));
    expect(checkProps(index, [t]).ok).toBe(true);
    t.parking = t.parking.slice(0, 9);
    expect(checkProps(index, [t]).ok).toBe(false);
  });
});
