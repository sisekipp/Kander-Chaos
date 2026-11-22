import { describe, expect, it } from 'vite-plus/test';
import { LandKind, signedArea } from '@kandern/world-format';
import { landKind, landPerTile, waterwayKind, waterwaysPerTile } from './landuse.ts';

describe('Landnutzung', () => {
  it('ordnet Waldtypen und Flächen zu', () => {
    expect(landKind({ landuse: 'forest', leaf_type: 'needleleaved' })).toBe(LandKind.ForestConiferous);
    expect(landKind({ natural: 'wood' })).toBe(LandKind.ForestMixed);
    expect(landKind({ landuse: 'orchard' })).toBe(LandKind.Orchard);
    expect(landKind({ landuse: 'vineyard' })).toBe(LandKind.Vineyard);
    expect(landKind({ amenity: 'parking' })).toBeNull();
  });

  it('schneidet einen Wald mit Lichtung auf Kacheln zu', () => {
    const tiles = landPerTile(
      [
        {
          id: 1,
          kind: LandKind.ForestMixed,
          outers: [[0, 0, 400, 0, 400, 200, 0, 200]],
          inners: [[50, 50, 50, 100, 100, 100, 100, 50]],
        },
      ],
      250,
      () => true,
    );
    expect([...tiles.keys()].sort()).toEqual(['0,0', '1,0']);
    const t0 = tiles.get('0,0')![0];
    expect(t0.kind).toBe(LandKind.ForestMixed);
    expect(t0.rings).toHaveLength(2);
    expect(signedArea(t0.rings[0])).toBeCloseTo(250 * 200);
    expect(signedArea(t0.rings[1])).toBeLessThan(0);
    expect(signedArea(tiles.get('1,0')![0].rings[0])).toBeCloseTo(150 * 200);
  });

  it('Gewässerlinien (Kander)', () => {
    expect(waterwayKind({ waterway: 'river' })?.kind).toBe('river');
    const t = waterwaysPerTile(
      [{ id: 1, kind: 'river', width: 8, name: 'Kander', coords: [10, 10, 300, 20] }],
      250,
      () => true,
    );
    expect(t.get('1,0')![0].name).toBe('Kander');
  });
});
