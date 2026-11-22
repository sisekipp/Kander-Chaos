import { describe, expect, it } from 'vite-plus/test';
import { ConflictMap } from './conflicts.ts';
import { propTile } from './testFixtures.ts';

describe('Konfliktraster', () => {
  const m = new ConflictMap(0, 0, 250);
  m.addTile(propTile());

  it('Fahrbahn und Gebäude sind belegt, daneben frei', () => {
    expect(m.isFree(120, 50, 0.3)).toBe(false); // Fahrbahn
    expect(m.isFree(120, 55, 0.3)).toBe(true); // Gehwegrand (Fahrbahn 3 m + 0,4 m Abstand + Rasterung)
    expect(m.isFree(105, 105, 0.3)).toBe(false); // im Haus
    expect(m.isFree(130, 130, 0.5)).toBe(true);
  });

  it('Fußwege blockieren nur, wenn nicht erlaubt', () => {
    expect(m.isFree(50, 150, 0.3)).toBe(false);
    expect(m.isFree(50, 150, 0.3, true)).toBe(true);
  });

  it('Straßen der Nachbarkachel wirken über die Grenze', () => {
    const n = new ConflictMap(0, 1, 250);
    const below = propTile(0, 0);
    below.roads = [{ ...below.roads[0], points: new Float32Array([0, 249, 250, 249]) }];
    n.addTile(below);
    expect(n.isFree(100, 251, 0.3)).toBe(false);
  });

  it('gesetzte Props belegen ihren Platz', () => {
    const k = new ConflictMap(0, 0, 250);
    k.fillCircle(200, 200, 0.6);
    expect(k.isFree(200.3, 200, 0.3)).toBe(false);
    expect(k.inTile(200, 200)).toBe(true);
    expect(k.inTile(251, 200)).toBe(false);
  });
});
