import { describe, expect, it } from 'vite-plus/test';
import { VehicleKind } from '@kandern/world-format';
import { VehicleSelection, type Spot } from './selection.ts';

const spot = (id: number, x: number, z = 0): Spot => ({ id, x, z, heading: 0, kind: VehicleKind.Car, tileId: '0,0' });

describe('Fahrzeugauswahl', () => {
  it('besetzt höchstens 24 Stellen, die nächsten zuerst', () => {
    const s = new VehicleSelection();
    const spots = Array.from({ length: 40 }, (_, i) => spot(i, i * 10));
    const chosen = s.chooseSpots(spots, 0, 0, 0);
    expect(chosen).toHaveLength(24);
    expect(chosen.at(-1)!.id).toBe(23);
    expect(s.chooseSpots(spots, 0, 0, 0, 4)).toHaveLength(20); // gemerkte Fahrzeuge zählen mit
  });

  it('höchstens 8 mit voller Physik; das gefahrene und angestoßene haben Vorrang', () => {
    const s = new VehicleSelection();
    const vs = Array.from({ length: 12 }, (_, i) => ({ id: i, x: i, z: 0, awake: false }));
    vs[11].awake = true;
    const dyn = s.chooseDynamic(vs, 0, 0, 10);
    expect(dyn.size).toBe(8);
    expect(dyn.has(10)).toBe(true);
    expect(dyn.has(11)).toBe(true);
    expect(dyn.has(9)).toBe(false);
  });

  it('weit entfernte, ruhende Fahrzeuge bleiben statisch', () => {
    const s = new VehicleSelection();
    expect(s.chooseDynamic([{ id: 1, x: 200, z: 0, awake: false }], 0, 0, null).size).toBe(0);
  });

  it('zerstörte Stelle: gesperrt, bis sie 60 s außer Sicht war', () => {
    const s = new VehicleSelection();
    const sp = [spot(7, 50)];
    s.markDestroyed(7, 0);
    s.observe(sp, 0, 0, 30_000); // in Sichtweite (50 m)
    expect(s.isBlocked(7, 80_000)).toBe(true);
    s.observe(sp, 500, 0, 80_000); // weit weg
    expect(s.isBlocked(7, 89_999)).toBe(true);
    expect(s.isBlocked(7, 90_000)).toBe(false);
  });

  it('zerstörte Stelle: wieder frei, wenn die Kachel neu geladen wurde', () => {
    const s = new VehicleSelection();
    s.markDestroyed(3, 0);
    s.tileUnloaded([3]);
    expect(s.isBlocked(3, 1)).toBe(false);
  });

  it('zuletzt gefahrenes Fahrzeug bleibt bis 1 km erhalten', () => {
    const s = new VehicleSelection();
    expect(s.keepLastDriven(0, 0, 999, 0)).toBe(true);
    expect(s.keepLastDriven(0, 0, 1001, 0)).toBe(false);
  });
});
