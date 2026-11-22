import { describe, expect, it } from 'vite-plus/test';
import { GeoBuilder } from '../gen/GeoBuilder.ts';
import { RoadCode, decodeMarking, Marking } from './profile.ts';
import { APRON_WIDTH, addRoundabout, roundaboutRings, segmentsFor } from './roundaboutMesh.ts';

const k = { x: 100, z: 100, radius: 15, width: 7 };

describe('Kreisverkehr-Geometrie', () => {
  it('Querschnitt: Insel, Innenring, Fahrbahn von innen nach außen', () => {
    const r = roundaboutRings(k);
    expect(r.map((p) => p.code)).toEqual([
      RoadCode.Curb,
      RoadCode.Paving,
      RoadCode.Curb,
      RoadCode.AsphaltMain,
      RoadCode.AsphaltMain,
    ]);
    expect(r[0].rho).toBeCloseTo(15 - 3.5 - APRON_WIDTH);
    expect(r[r.length - 1].rho).toBe(18.5);
    expect(r[0].h).toBeGreaterThan(r[1].h);
  });

  it('rund: mindestens 32 Segmente, bei großen Ringen etwa alle 2 m', () => {
    expect(segmentsFor({ ...k, radius: 5 })).toBe(32);
    expect(segmentsFor({ ...k, radius: 30 })).toBe(Math.ceil((2 * Math.PI * 33.5) / 2));
  });

  it('Fahrbahn liegt zwischen innerem und äußerem Radius, mit Randlinien-Markierung', () => {
    const g = new GeoBuilder(true);
    addRoundabout(g, k, () => 300);
    const b = g.build()!;
    let maxR = 0;
    for (let v = 0; v < b.positions.length / 3; v++) {
      const rho = Math.hypot(b.positions[v * 3] - 100, b.positions[v * 3 + 2] - 100);
      maxR = Math.max(maxR, rho);
      if (b.uvs2![v * 2] === RoadCode.AsphaltMain) {
        expect(rho).toBeGreaterThan(11.4);
        expect(decodeMarking(b.uvs2![v * 2 + 1]).marking).toBe(Marking.Edges);
      }
    }
    expect(maxR).toBeCloseTo(18.5, 3);
    const codes = new Set(Array.from({ length: b.uvs2!.length / 2 }, (_, i) => b.uvs2![i * 2]));
    expect(codes.has(RoadCode.Grass)).toBe(true);
    expect(codes.has(RoadCode.Paving)).toBe(true);
  });
});
