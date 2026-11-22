import { describe, expect, it } from 'vite-plus/test';
import { decodeTile, encodeTile, sampleHeight, quantizeHeight } from './tile.ts';
import { makeTile } from './testFixtures.ts';
import { TILE_MAGIC } from './types.ts';

describe('Kachelformat Round-Trip', () => {
  const tile = makeTile();
  const decoded = decodeTile(encodeTile(tile));

  it('Kopf', () => {
    expect(decoded.tx).toBe(3);
    expect(decoded.tz).toBe(-2);
    expect(decoded.size).toBe(250);
    expect(decoded.quant.base).toBeCloseTo(tile.quant.base);
    expect(decoded.quant.step).toBeCloseTo(tile.quant.step, 6);
  });

  it('Höhenraster', () => {
    expect(decoded.lods).toHaveLength(2);
    expect(decoded.lods[0].samples).toBe(5);
    expect([...decoded.lods[0].heights]).toEqual([...tile.lods[0].heights]);
    expect([...decoded.lods[1].heights]).toEqual([1, 2, 3, 4]);
  });

  it('Gebäude', () => {
    expect(decoded.buildings).toHaveLength(1);
    const b = decoded.buildings[0];
    const src = tile.buildings[0];
    expect(b.id).toBe(src.id);
    expect(b.type).toBe(src.type);
    expect(b.roof).toBe(src.roof);
    expect(b.levels).toBe(2);
    expect(b.estimated).toBe(true);
    expect(b.wallHeight).toBeCloseTo(6.5);
    expect(b.roofHeight).toBeCloseTo(4);
    expect([...b.outline]).toEqual([...src.outline]);
  });

  it('Straßen', () => {
    const r = decoded.roads[0];
    expect(r).toMatchObject({
      id: 42,
      kind: 1,
      width: 7,
      startNode: 9_876_543_210,
      endNode: 11,
      name: 'Hauptstraße',
      bridge: true,
      tunnel: false,
    });
    expect([...r.points]).toEqual([0, 125, 250, 125]);
  });

  it('Landnutzung', () => {
    expect(decoded.land[0].kind).toBe(tile.land[0].kind);
    expect(decoded.land[0].rings.map((r) => [...r])).toEqual(tile.land[0].rings.map((r) => [...r]));
  });

  it('Gewässer', () => {
    expect(decoded.waterways[0]).toMatchObject({ kind: 'river', width: 6, name: 'Kander' });
  });

  it('ist deterministisch', () => {
    expect(encodeTile(makeTile())).toEqual(encodeTile(makeTile()));
  });

  it('lehnt fremde Daten ab', () => {
    expect(() => decodeTile(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow(/Kennung/);
  });

  it('lehnt abgeschnittene Daten ab', () => {
    const bytes = encodeTile(tile);
    expect(new DataView(bytes.buffer).getUint32(0, true)).toBe(TILE_MAGIC);
    expect(() => decodeTile(bytes.subarray(0, 30))).toThrow();
  });
});

describe('Höhenabfrage', () => {
  it('quantisiert und tastet bilinear ab', () => {
    const q = { base: 100, step: 0.5 };
    const lod = { samples: 2, heights: new Uint16Array([0, 2, 4, 6].map((v) => v)) };
    const t = { quant: q, size: 10 };
    expect(sampleHeight(t, lod, 0, 0)).toBe(100);
    expect(sampleHeight(t, lod, 10, 10)).toBe(103);
    expect(sampleHeight(t, lod, 5, 5)).toBeCloseTo(101.5);
    expect(quantizeHeight(q, 101.5)).toBe(3);
  });
});
