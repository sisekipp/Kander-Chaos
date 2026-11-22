import { describe, expect, it } from 'vite-plus/test';
import { GeoBuilder } from '../gen/GeoBuilder.ts';
import { PIER_MIN_CLEARANCE, PIER_SPACING, addPiers, pierSpots, tunnelEnds } from './bridgeMesh.ts';

describe('Brückenpfeiler', () => {
  // 100 m Brücke in 310 m Höhe über einem Tal (Gelände 300 m, an den Enden 309 m)
  const ground = (x: number) => (x < 10 || x > 90 ? 309 : 300);

  it('Pfeiler im Abstand von 15 m, mittig verteilt', () => {
    const s = pierSpots([0, 0, 100, 0], 310, 310, ground);
    for (let i = 1; i < s.length; i++) expect(s[i].x - s[i - 1].x).toBeCloseTo(PIER_SPACING);
    const xs = s.map((p) => p.x);
    expect(xs[0] - 0).toBeCloseTo(100 - xs[xs.length - 1], 5);
  });

  it('nur wo die Fahrbahn mehr als 3 m über dem Gelände liegt', () => {
    const s = pierSpots([0, 0, 100, 0], 310, 310, ground);
    for (const p of s) expect(p.deck - p.ground).toBeGreaterThan(PIER_MIN_CLEARANCE);
    expect(s.every((p) => p.x >= 10 && p.x <= 90)).toBe(true);
    expect(pierSpots([0, 0, 100, 0], 302, 302, ground)).toEqual([]);
  });

  it('kurze Brücken (< 15 m) ohne Pfeiler, Pfeiler folgen geknickter Linie', () => {
    expect(pierSpots([0, 0, 12, 0], 310, 310, () => 300)).toEqual([]);
    const s = pierSpots([0, 0, 30, 0, 30, 30], 310, 310, () => 300);
    expect(s.length).toBe(4);
    expect(s.some((p) => p.dz === 1)).toBe(true);
  });

  it('Pfeiler-Geometrie reicht vom Gelände bis unter das Deck', () => {
    const g = new GeoBuilder(true);
    addPiers(g, pierSpots([0, 0, 100, 0], 310, 310, ground), 7);
    const ys = Array.from({ length: g.build()!.positions.length / 3 }, (_, i) => g.build()!.positions[i * 3 + 1]);
    expect(Math.min(...ys)).toBeLessThan(300);
    expect(Math.max(...ys)).toBeLessThan(310);
  });

  it('Tunnelportale nur an echten Enden, nicht an Kachelschnitten', () => {
    expect(tunnelEnds([0, 0, 10, 0], 5, 6)).toHaveLength(2);
    expect(tunnelEnds([0, 0, 10, 0], 5, 4e15 + 12)).toHaveLength(1);
  });
});
