import { describe, expect, it } from 'vite-plus/test';
import { LandKind, signedArea } from '@kandern/world-format';
import { bufferLine, lineLandKind, lineWidth } from './aeroway.ts';
import { landKind } from './landuse.ts';

describe('Flughafen- und Bahnflächen', () => {
  it('erkennt Linien und Flächen', () => {
    expect(lineLandKind({ aeroway: 'runway' })).toBe(LandKind.Runway);
    expect(lineLandKind({ aeroway: 'taxiway' })).toBe(LandKind.Taxiway);
    expect(lineLandKind({ railway: 'platform' })).toBe(LandKind.Platform);
    expect(lineLandKind({ highway: 'service' })).toBeNull();
    expect(landKind({ aeroway: 'apron' })).toBe(LandKind.Apron);
    expect(landKind({ 'area:aeroway': 'runway' })).toBe(LandKind.Runway);
  });

  it('Breite aus dem Tag oder Standard (Piste 60 m)', () => {
    expect(lineWidth({ width: '45' }, LandKind.Runway)).toBe(45);
    expect(lineWidth({}, LandKind.Runway)).toBe(60);
  });

  it('verbreitert eine 1000-m-Linie zu einer Fläche von Länge × Breite', () => {
    const ring = bufferLine([0, 0, 500, 0, 1000, 0], 60)!;
    expect(Math.abs(signedArea(ring))).toBeCloseTo(60000, -1);
  });
});
