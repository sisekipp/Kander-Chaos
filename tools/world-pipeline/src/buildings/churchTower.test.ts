import { describe, expect, it } from 'vite-plus/test';
import { BuildingType, RoofShape, pointInRing, type Building } from '@kandern/world-format';
import { churchTower, isTowerPart } from './churchTower.ts';

function church(outline: number[], type = BuildingType.Church): Building {
  return {
    id: 7,
    type,
    roof: RoofShape.Gabled,
    wallHeight: 12,
    roofHeight: 8,
    levels: 1,
    outline: new Float32Array(outline),
    estimated: false,
  };
}

describe('Kirchturm', () => {
  // Kirchenschiff 30 m (West–Ost) × 12 m
  const nave = church([0, 0, 30, 0, 30, 12, 0, 12]);

  it('Regel: Turm an der westlichen Schmalseite, innerhalb des Grundrisses', () => {
    const t = churchTower(nave, [])!;
    expect(t.x).toBeLessThan(10);
    expect(t.z).toBeCloseTo(6);
    expect(t.size).toBeGreaterThanOrEqual(4);
    expect(t.size).toBeLessThanOrEqual(8);
    expect(pointInRing(t.x - t.size / 2 + 0.01, t.z, nave.outline)).toBe(true);
  });

  it('Regel gilt unabhängig von der Umlaufrichtung des Grundrisses', () => {
    const t = churchTower(church([30, 12, 0, 12, 0, 0, 30, 0]), [])!;
    expect(t.x).toBeLessThan(10);
  });

  it('Nord-Süd-Kirche: Turm an einer Schmalseite', () => {
    const t = churchTower(church([0, 0, 12, 0, 12, 30, 0, 30]), [])!;
    expect(t.x).toBeCloseTo(6);
    expect(t.z < 8 || t.z > 22).toBe(true);
  });

  it('Gebäudeteil hat Vorrang vor der Regel', () => {
    const part = [24, 3, 30, 3, 30, 9, 24, 9]; // Turm im Osten
    const t = churchTower(nave, [part])!;
    expect(t.x).toBeCloseTo(27);
    expect(t.z).toBeCloseTo(6);
    expect(t.size).toBeCloseTo(6);
  });

  it('Gebäudeteil außerhalb der Kirche wird ignoriert', () => {
    expect(churchTower(nave, [[100, 100, 106, 100, 106, 106, 100, 106]])!.x).toBeLessThan(10);
  });

  it('keine Türme für Nicht-Kirchen und kleine Kapellen', () => {
    expect(churchTower(church([0, 0, 30, 0, 30, 12, 0, 12], BuildingType.Residential), [])).toBeNull();
    expect(churchTower(church([0, 0, 8, 0, 8, 5, 0, 5]), [])).toBeNull();
  });

  it('erkennt Turm-Gebäudeteile', () => {
    expect(isTowerPart({ 'building:part': 'tower' })).toBe(true);
    expect(isTowerPart({ man_made: 'tower', 'tower:type': 'bell_tower' })).toBe(true);
    expect(isTowerPart({ 'building:part': 'yes' })).toBe(false);
  });
});
