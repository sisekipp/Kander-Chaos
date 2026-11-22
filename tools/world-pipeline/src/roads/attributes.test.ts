import { describe, expect, it } from 'vite-plus/test';
import { LandKind, RoadKind, Surface } from '@kandern/world-format';
import { roadAttributes, settlementLookup } from './attributes.ts';

describe('Straßenattribute', () => {
  it('übernimmt OSM-Angaben', () => {
    const a = roadAttributes(
      { highway: 'secondary', lanes: '3', surface: 'sett', sidewalk: 'left', layer: '2' },
      RoadKind.Secondary,
      false,
    );
    expect(a).toEqual({
      lanes: 3,
      oneway: false,
      sidewalkLeft: true,
      sidewalkRight: false,
      surface: Surface.Paving,
      layer: 2,
      roundabout: false,
    });
  });

  it('fehlender Gehweg im Ortskern: beidseitig ergänzt', () => {
    const a = roadAttributes({ highway: 'residential' }, RoadKind.Residential, true);
    expect([a.sidewalkLeft, a.sidewalkRight]).toEqual([true, true]);
  });

  it('außerorts ohne Angabe kein Gehweg', () => {
    const a = roadAttributes({ highway: 'tertiary' }, RoadKind.Tertiary, false);
    expect([a.sidewalkLeft, a.sidewalkRight]).toEqual([false, false]);
  });

  it('ausdrücklich ohne oder separat gemappter Gehweg wird nicht ergänzt', () => {
    expect(roadAttributes({ highway: 'residential', sidewalk: 'no' }, RoadKind.Residential, true).sidewalkLeft).toBe(
      false,
    );
    const sep = roadAttributes({ highway: 'residential', sidewalk: 'separate' }, RoadKind.Residential, true);
    expect([sep.sidewalkLeft, sep.sidewalkRight]).toEqual([false, false]);
    const right = roadAttributes({ highway: 'residential', 'sidewalk:right': 'yes' }, RoadKind.Residential, true);
    expect([right.sidewalkLeft, right.sidewalkRight]).toEqual([false, true]);
  });

  it('verkehrsberuhigter Bereich bekommt keinen ergänzten Gehweg', () => {
    expect(roadAttributes({ highway: 'living_street' }, RoadKind.Residential, true).sidewalkLeft).toBe(false);
  });

  it('Einbahn: oneway, Kreisverkehr und Autobahn', () => {
    expect(roadAttributes({ highway: 'residential', oneway: 'yes' }, RoadKind.Residential, true).oneway).toBe(true);
    expect(roadAttributes({ highway: 'tertiary', junction: 'roundabout' }, RoadKind.Tertiary, true)).toMatchObject({
      oneway: true,
      roundabout: true,
    });
    const m = roadAttributes({ highway: 'motorway' }, RoadKind.Motorway, false);
    expect(m).toMatchObject({ oneway: true, lanes: 2 });
  });

  it('Standard-Fahrstreifen und Belag je Art', () => {
    expect(roadAttributes({ highway: 'residential' }, RoadKind.Residential, false).lanes).toBe(2);
    expect(roadAttributes({ highway: 'service' }, RoadKind.Service, false).lanes).toBe(1);
    expect(roadAttributes({ highway: 'footway' }, RoadKind.Footway, true)).toMatchObject({
      lanes: 0,
      surface: Surface.Paving,
    });
    expect(roadAttributes({ highway: 'track' }, RoadKind.Track, false).surface).toBe(Surface.Gravel);
    expect(roadAttributes({ highway: 'track', tracktype: 'grade1' }, RoadKind.Track, false).surface).toBe(
      Surface.Asphalt,
    );
    expect(roadAttributes({ highway: 'track', tracktype: 'grade5' }, RoadKind.Track, false).surface).toBe(
      Surface.Grass,
    );
  });

  it('Ebene: Tag, sonst Brücke +1 / Tunnel −1, begrenzt auf ±5', () => {
    expect(roadAttributes({ highway: 'primary', bridge: 'yes' }, RoadKind.Primary, false).layer).toBe(1);
    expect(roadAttributes({ highway: 'primary', tunnel: 'yes' }, RoadKind.Primary, false).layer).toBe(-1);
    expect(roadAttributes({ highway: 'primary', layer: '9' }, RoadKind.Primary, false).layer).toBe(5);
  });
});

describe('settlementLookup', () => {
  const inTown = settlementLookup([
    { kind: LandKind.Residential, outers: [[0, 0, 100, 0, 100, 100, 0, 100]] },
    { kind: LandKind.Farmland, outers: [[200, 0, 300, 0, 300, 100, 200, 100]] },
  ]);
  it('nur Siedlungsflächen zählen', () => {
    expect(inTown(50, 50)).toBe(true);
    expect(inTown(250, 50)).toBe(false);
    expect(inTown(150, 50)).toBe(false);
  });
});
