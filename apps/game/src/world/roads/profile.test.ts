import { describe, expect, it } from 'vite-plus/test';
import { RoadKind, Surface, type RoadDetail } from '@kandern/world-format';
import { CURB_HEIGHT, Marking, RoadCode, decodeMarking, encodeMarking, roadProfile } from './profile.ts';

const detail = (o: Partial<RoadDetail> = {}): RoadDetail => ({
  lanes: 2,
  oneway: false,
  sidewalkLeft: false,
  sidewalkRight: false,
  surface: Surface.Asphalt,
  layer: 0,
  trimStart: 0,
  trimEnd: 0,
  deckStart: NaN,
  deckEnd: NaN,
  ...o,
});
const codes = (p: ReturnType<typeof roadProfile>) => p.segments.map((s) => s.code);

describe('Straßenquerschnitt', () => {
  it('Hauptstraße: Mittellinie und Randlinien, Asphalt', () => {
    const p = roadProfile(RoadKind.Primary, 8, detail());
    expect(p.marking).toBe(Marking.CenterAndEdges);
    expect(codes(p)).toEqual([RoadCode.AsphaltMain]);
    expect(p.halfCarriageway).toBe(4);
  });

  it('Wohnstraße mit Gehwegen: Gehweg, Bordstein, Fahrbahn, Bordstein, Gehweg', () => {
    const p = roadProfile(RoadKind.Residential, 6, detail({ sidewalkLeft: true, sidewalkRight: true }));
    expect(codes(p)).toEqual([
      RoadCode.Sidewalk,
      RoadCode.Curb,
      RoadCode.AsphaltMinor,
      RoadCode.Curb,
      RoadCode.Sidewalk,
    ]);
    expect(p.totalWidth).toBe(10);
    expect(p.segments[0].a.h).toBe(CURB_HEIGHT);
    // Bordstein ist senkrecht
    expect(p.segments[1].a.c).toBe(p.segments[1].b.c);
    // Wohnstraßen ohne Mittellinie (wie in Deutschland üblich), Kreisstraße gestrichelt
    expect(p.marking).toBe(Marking.None);
    expect(roadProfile(RoadKind.Tertiary, 6.5, detail()).marking).toBe(Marking.CenterDashed);
  });

  it('nur rechter Gehweg: Querschnitt asymmetrisch', () => {
    const p = roadProfile(RoadKind.Residential, 6, detail({ sidewalkRight: true }));
    expect(codes(p)).toEqual([RoadCode.AsphaltMinor, RoadCode.Curb, RoadCode.Sidewalk]);
    expect(Math.max(...p.segments.map((s) => s.b.c))).toBe(5);
  });

  it('Autobahn: Fahrstreifen-Markierung und Leitplanken beidseitig', () => {
    const p = roadProfile(RoadKind.Motorway, 11, detail({ oneway: true, lanes: 3 }));
    expect(p.marking).toBe(Marking.MotorwayLanes);
    expect(p.lanes).toBe(3);
    expect(codes(p).filter((c) => c === RoadCode.Guardrail)).toHaveLength(6);
    expect(Math.max(...p.segments.map((s) => s.b.h))).toBeCloseTo(0.75);
  });

  it('Feldweg: Code Feldweg (Grasstreifen im Shader), keine Markierung', () => {
    const p = roadProfile(RoadKind.Track, 3, detail({ surface: Surface.Gravel, lanes: 0 }));
    expect(codes(p)).toEqual([RoadCode.Track]);
    expect(p.marking).toBe(Marking.None);
    expect(roadProfile(RoadKind.Track, 3, detail({ surface: Surface.Asphalt })).segments[0].code).toBe(
      RoadCode.AsphaltMinor,
    );
  });

  it('Fuß- und Radwege', () => {
    expect(codes(roadProfile(RoadKind.Footway, 2, detail({ surface: Surface.Paving })))).toEqual([RoadCode.Footway]);
    expect(codes(roadProfile(RoadKind.Cycleway, 2.2, detail()))).toEqual([RoadCode.Cycleway]);
    expect(codes(roadProfile(RoadKind.Path, 1.6, detail({ surface: Surface.Dirt })))).toEqual([RoadCode.Dirt]);
  });

  it('Pflasterstraße im Ortskern: Code Pflaster, keine Markierung', () => {
    const p = roadProfile(RoadKind.Residential, 5.5, detail({ surface: Surface.Paving }));
    expect(codes(p)).toEqual([RoadCode.Paving]);
    expect(p.marking).toBe(Marking.None);
  });

  it('Brücke: Geländer auf beiden Seiten, auf Gehweghöhe', () => {
    const p = roadProfile(RoadKind.Secondary, 7, detail({ sidewalkLeft: true, sidewalkRight: true }), { bridge: true });
    const rails = p.segments.filter((s) => s.code === RoadCode.Concrete);
    expect(rails).toHaveLength(6);
    expect(Math.max(...rails.map((s) => Math.max(s.a.h, s.b.h)))).toBeCloseTo(1 + CURB_HEIGHT);
  });

  it('Ring 1: nur flaches Band ohne Gehweg', () => {
    const p = roadProfile(RoadKind.Residential, 6, detail({ sidewalkLeft: true, sidewalkRight: true }), {
      simple: true,
    });
    expect(p.segments).toHaveLength(1);
  });

  it('Markierung kodieren und dekodieren', () => {
    const enc = encodeMarking({ marking: Marking.MotorwayLanes, lanes: 3, halfCarriageway: 5.5 });
    expect(decodeMarking(enc)).toEqual({ marking: Marking.MotorwayLanes, lanes: 3, halfCarriageway: 5.5 });
  });
});
