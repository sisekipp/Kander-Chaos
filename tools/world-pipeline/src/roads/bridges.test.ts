import { describe, expect, it } from 'vite-plus/test';
import { RoadKind, Surface } from '@kandern/world-format';
import { MAX_SLOPE, MIN_CLEARANCE, bridgeChains, buildBridges, deckProfile } from './bridges.ts';
import type { WayPiece } from './network.ts';

function piece(id: number, coords: number[], startNode: number, endNode: number, bridge = true): WayPiece {
  return {
    id,
    kind: RoadKind.Secondary,
    width: 7,
    coords,
    startNode,
    endNode,
    name: '',
    bridge,
    tunnel: false,
    attrs: {
      lanes: 2,
      oneway: false,
      sidewalkLeft: false,
      sidewalkRight: false,
      surface: Surface.Asphalt,
      layer: 1,
      roundabout: false,
    },
  };
}

/** Flusstal: 300 m Höhe, zwischen x = 20 und 40 auf 295 m abgesenkt. */
const valley = (x: number) => (x > 20 && x < 40 ? 295 : 300);

describe('Brücken', () => {
  it('Enden liegen auf dem Gelände, Inneres mit Mindestabstand', () => {
    const { h } = deckProfile([0, 0, 60, 0], (x) => valley(x));
    expect(h[0]).toBeCloseTo(300);
    expect(h[h.length - 1]).toBeCloseTo(300);
    for (const v of h) expect(v).toBeGreaterThanOrEqual(295 + MIN_CLEARANCE - 1e-9);
  });

  it('Steigung höchstens 12 %, auch wenn das Gelände im Inneren ansteigt', () => {
    const hump = (x: number) => (x > 25 && x < 35 ? 310 : 300);
    const { s, h } = deckProfile([0, 0, 60, 0], hump);
    for (let k = 1; k < h.length; k++)
      expect(Math.abs(h[k] - h[k - 1]) / (s[k] - s[k - 1])).toBeLessThanOrEqual(MAX_SLOPE + 1e-9);
    expect(h[0]).toBeCloseTo(300);
  });

  it('verkettet Stücke über Knoten zu einem Zug, unabhängig von der Richtung', () => {
    const a = piece(1000, [0, 0, 30, 0], 1, 2);
    const b = piece(2000, [60, 0, 30, 0], 3, 2); // entgegengesetzt digitalisiert
    const chains = bridgeChains([b, a, piece(3000, [60, 0, 90, 0], 3, 4, false)]);
    expect(chains).toHaveLength(1);
    expect(chains[0].map((p) => [p.piece.id, p.reversed])).toEqual([
      [1000, false],
      [2000, true],
    ]);
  });

  it('nahtlose Höhe am gemeinsamen Knoten und an einer Kachelgrenze', () => {
    const ground = (x: number, _z = 0) => 300 + x * 0.05 - (x > 10 && x < 50 ? 6 : 0);
    const a = piece(1000, [0, 0, 30, 0], 1, 2);
    const b = piece(2000, [30, 0, 60, 0], 2, 3);
    const decks = buildBridges([a, b], ground);
    // Gemeinsamer Knoten bei x = 30 aus beiden Stücken
    expect(decks.get(1000)!(30, 0)).toBeCloseTo(decks.get(2000)!(30, 0), 6);
    // Kachelgrenze z. B. bei x = 25 liegt mitten in Stück a: beide Teilstücke fragen dieselbe Funktion ab
    const left = decks.get(1000)!(25, 0);
    expect(left).toBeGreaterThan(ground(25, 0) + MIN_CLEARANCE - 1e-6);
    // Enden des Zugs auf dem Gelände
    expect(decks.get(1000)!(0, 0)).toBeCloseTo(ground(0, 0));
    expect(decks.get(2000)!(60, 0)).toBeCloseTo(ground(60, 0));
  });

  it('Verzweigung: Stücke einzeln behandelt', () => {
    const chains = bridgeChains([
      piece(1000, [0, 0, 10, 0], 1, 2),
      piece(2000, [10, 0, 20, 0], 2, 3),
      piece(3000, [10, 0, 10, 10], 2, 4),
    ]);
    expect(chains).toHaveLength(3);
  });

  it('ignoriert Nicht-Brücken', () => {
    expect(buildBridges([piece(1, [0, 0, 10, 0], 1, 2, false)], () => 0).size).toBe(0);
  });

  it('Verzweigung: am gemeinsamen Knoten gleiche Fahrbahnhöhe (kein Sprung)', () => {
    const ps = [
      piece(1000, [0, 0, 30, 0], 1, 2),
      piece(2000, [30, 0, 60, 0], 2, 3),
      piece(3000, [30, 0, 30, 40], 2, 4),
    ];
    const decks = buildBridges(ps, (x, z) => valley(x) + z * 0.1);
    const hs = ps.map((p) => decks.get(p.id)!(30, 0));
    expect(Math.max(...hs) - Math.min(...hs)).toBeLessThan(0.01);
  });
});
