import { describe, expect, it } from 'vite-plus/test';
import { RoadKind, Surface, pointInRing, signedArea } from '@kandern/world-format';
import { buildJunctions } from './junctions.ts';
import type { WayPiece } from './network.ts';

const NODE = 1;
let nextId = 10;

/** Arm vom Knoten (0,0) in Richtung `deg` (0 = Osten, 90 = Norden), Länge `len`. */
function arm(deg: number, width = 6, len = 60, sidewalks = false): WayPiece {
  const a = (deg * Math.PI) / 180;
  return {
    id: nextId++ * 1000,
    kind: RoadKind.Residential,
    width,
    coords: [0, 0, Math.cos(a) * len, Math.sin(a) * len],
    startNode: NODE,
    endNode: nextId * 7,
    name: '',
    bridge: false,
    tunnel: false,
    attrs: {
      lanes: 2,
      oneway: false,
      sidewalkLeft: sidewalks,
      sidewalkRight: sidewalks,
      surface: Surface.Asphalt,
      layer: 0,
      roundabout: false,
    },
  };
}

/** Wie `arm`, aber das Stück endet am Knoten (Richtung umgedreht). */
function armReversed(deg: number, width = 6): WayPiece {
  const p = arm(deg, width);
  return { ...p, coords: [p.coords[2], p.coords[3], 0, 0], startNode: p.endNode, endNode: NODE };
}

describe('Kreuzungen', () => {
  it('T-Kreuzung: Polygon enthält den Knoten, Arme um die halbe Breite der Querstraße gekürzt', () => {
    const pieces = [arm(0), arm(180), arm(90, 8)];
    const { junctions, trims } = buildJunctions(pieces);
    expect(junctions).toHaveLength(1);
    const j = junctions[0];
    expect(j.fallback).toBe(false);
    expect(signedArea(j.ring)).toBeGreaterThan(0);
    expect(pointInRing(0, 0, j.ring)).toBe(true);
    // Hauptstraße: um halbe Breite der Stichstraße (4 m) gekürzt, Stichstraße um halbe Hauptstraßenbreite (3 m)
    expect(trims.get(pieces[0].id)!.start).toBeCloseTo(4);
    expect(trims.get(pieces[1].id)!.start).toBeCloseTo(4);
    expect(trims.get(pieces[2].id)!.start).toBeCloseTo(3);
    // Südkante der Hauptstraße bleibt gerade: kein Punkt südlich von z = -3
    for (let i = 1; i < j.ring.length; i += 2) expect(j.ring[i]).toBeGreaterThanOrEqual(-3 - 1e-6);
  });

  it('X-Kreuzung mit Gehwegen: Quadrat mit Kantenlänge Straßenbreite + Gehwege', () => {
    const pieces = [arm(0, 6, 60, true), arm(90, 6, 60, true), arm(180, 6, 60, true), armReversed(270, 6)];
    pieces[3] = { ...pieces[3], attrs: { ...pieces[3].attrs, sidewalkLeft: true, sidewalkRight: true } };
    const { junctions, trims } = buildJunctions(pieces);
    const j = junctions[0];
    expect(j.fallback).toBe(false);
    expect(Math.abs(signedArea(j.ring))).toBeCloseTo(10 * 10, 0);
    for (const p of pieces) {
      const t = trims.get(p.id)!;
      expect(Math.max(t.start, t.end)).toBeCloseTo(5);
    }
  });

  it('Y-Kreuzung (120°): alle Arme gekürzt, Polygon gültig', () => {
    const pieces = [arm(90), arm(210), arm(330)];
    const { junctions, trims } = buildJunctions(pieces);
    expect(junctions[0].fallback).toBe(false);
    expect(pointInRing(0, 0, junctions[0].ring)).toBe(true);
    for (const p of pieces) expect(trims.get(p.id)!.start).toBeGreaterThan(1);
  });

  it('spitzer Winkel (25°): spitze Arme werden länger gekürzt, kein Rückfall', () => {
    const pieces = [arm(0), arm(25), arm(180)];
    const { junctions, trims } = buildJunctions(pieces);
    expect(junctions[0].fallback).toBe(false);
    expect(trims.get(pieces[1].id)!.start).toBeGreaterThan(trims.get(pieces[2].id)!.start);
    expect(trims.get(pieces[1].id)!.start).toBeGreaterThan(6);
  });

  it('fast parallele Arme (5°): Rückfall auf Kreisscheibe', () => {
    const pieces = [arm(0), arm(5), arm(180)];
    const { junctions, trims } = buildJunctions(pieces);
    expect(junctions[0].fallback).toBe(true);
    expect(junctions[0].ring).toHaveLength(24);
    expect(trims.get(pieces[2].id)!.start).toBeCloseTo(3.5);
  });

  it('sehr kurzer Arm: Rückfall, Kürzung höchstens 45 % der Armlänge', () => {
    const pieces = [arm(0), arm(180), arm(90, 12, 6)];
    const { junctions, trims } = buildJunctions(pieces);
    expect(junctions[0].fallback).toBe(true);
    expect(trims.get(pieces[2].id)!.start).toBeLessThanOrEqual(6 * 0.45 + 1e-9);
  });

  it('Knoten mit 2 Armen und Fußwege bilden keine Kreuzung', () => {
    const foot = { ...arm(90), kind: RoadKind.Footway };
    expect(buildJunctions([arm(0), arm(180)]).junctions).toHaveLength(0);
    expect(buildJunctions([arm(0), arm(180), foot]).junctions).toHaveLength(0);
  });

  it('ist deterministisch', () => {
    const pieces = [arm(0), arm(100), arm(200)];
    expect(buildJunctions(pieces)).toEqual(buildJunctions([...pieces].reverse()));
  });
});
