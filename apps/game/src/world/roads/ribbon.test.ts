import { describe, expect, it } from 'vite-plus/test';
import { RoadKind, Surface, type RoadDetail } from '@kandern/world-format';
import { GeoBuilder } from '../gen/GeoBuilder.ts';
import { RoadCode, decodeMarking, roadProfile } from './profile.ts';
import { ROAD_LIFT, extrudeRibbon, trimAndDensify } from './ribbon.ts';

const detail: RoadDetail = {
  lanes: 2,
  oneway: false,
  sidewalkLeft: true,
  sidewalkRight: true,
  surface: Surface.Asphalt,
  layer: 0,
  trimStart: 0,
  trimEnd: 0,
  deckStart: NaN,
  deckEnd: NaN,
};

function build(opts: Partial<Parameters<typeof extrudeRibbon>[1]> = {}) {
  const g = new GeoBuilder(true);
  const len = extrudeRibbon(g, {
    points: [0, 50, 100, 50],
    profile: roadProfile(RoadKind.Secondary, 7, detail),
    trimStart: 0,
    trimEnd: 0,
    ground: () => 300,
    deckStart: NaN,
    deckEnd: NaN,
    ...opts,
  });
  return { len, g: g.build() };
}

describe('Straßenband', () => {
  it('Querkoordinate entspricht dem Abstand zur Mittellinie', () => {
    const { g } = build();
    const { positions, uvs } = g!;
    for (let v = 0; v < positions.length / 3; v++) {
      // Straße läuft nach Osten bei z = 50; rechts = Süden -> z = 50 - c
      expect(positions[v * 3 + 2]).toBeCloseTo(50 - uvs![v * 2], 4);
    }
    const cs = Array.from({ length: uvs!.length / 2 }, (_, i) => uvs![i * 2]);
    expect(Math.min(...cs)).toBeCloseTo(-5.5);
    expect(Math.max(...cs)).toBeCloseTo(5.5);
  });

  it('Längskoordinate läuft von 0 bis zur Länge, Belag-Code und Markierung je Vertex', () => {
    const { g, len } = build();
    const ss = Array.from({ length: g!.uvs!.length / 2 }, (_, i) => g!.uvs![i * 2 + 1]);
    expect(Math.min(...ss)).toBe(0);
    expect(Math.max(...ss)).toBeCloseTo(100);
    expect(len).toBeCloseTo(100);
    const codes = new Set(Array.from({ length: g!.uvs2!.length / 2 }, (_, i) => g!.uvs2![i * 2]));
    expect(codes).toEqual(new Set([RoadCode.Sidewalk, RoadCode.Curb, RoadCode.AsphaltMain]));
    expect(decodeMarking(g!.uvs2![1]).halfCarriageway).toBeCloseTo(3.5);
  });

  it('Kürzung an Kreuzungen verschiebt Anfang und Ende', () => {
    const { g, len } = build({ trimStart: 6, trimEnd: 4 });
    const xs = Array.from({ length: g!.positions.length / 3 }, (_, i) => g!.positions[i * 3]);
    expect(Math.min(...xs)).toBeCloseTo(6);
    expect(Math.max(...xs)).toBeCloseTo(96);
    expect(len).toBeCloseTo(90);
  });

  it('vollständig weggekürzter Abschnitt erzeugt nichts', () => {
    expect(build({ trimStart: 60, trimEnd: 45 }).g).toBeNull();
  });

  it('Fahrbahn liegt über dem Gelände, Gehweg um die Bordsteinhöhe höher', () => {
    const { g } = build();
    const ys = Array.from({ length: g!.positions.length / 3 }, (_, i) => g!.positions[i * 3 + 1]);
    expect(Math.min(...ys)).toBeCloseTo(300 + ROAD_LIFT);
    expect(Math.max(...ys)).toBeCloseTo(300 + ROAD_LIFT + 0.12);
  });

  it('Brücke: Höhe linear zwischen den Deckhöhen statt Gelände', () => {
    const { g } = build({
      deckStart: 310,
      deckEnd: 320,
      profile: roadProfile(RoadKind.Secondary, 7, { ...detail, sidewalkLeft: false, sidewalkRight: false }),
    });
    const p = g!.positions;
    for (let v = 0; v < p.length / 3; v++) expect(p[v * 3 + 1]).toBeCloseTo(310 + ROAD_LIFT + p[v * 3] / 10, 3);
  });

  it('unterteilt lange Segmente auf ≤ 4 m', () => {
    const { s } = trimAndDensify([0, 0, 10, 0], 0, 10);
    expect(s).toEqual([0, 10 / 3, 20 / 3, 10]);
  });
});
