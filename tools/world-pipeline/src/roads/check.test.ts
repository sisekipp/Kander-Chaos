import { describe, expect, it } from 'vite-plus/test';
import { BuildingType, RoadKind, RoofShape, Surface, type RoadDetail, type TileData } from '@kandern/world-format';
import { checkDetails } from './check.ts';

const detail = (deckStart = NaN, deckEnd = NaN): RoadDetail => ({
  lanes: 2,
  oneway: false,
  sidewalkLeft: false,
  sidewalkRight: false,
  surface: Surface.Asphalt,
  layer: 0,
  trimStart: 0,
  trimEnd: 0,
  deckStart,
  deckEnd,
});

function tile(tx: number, opts: { deck?: [number, number]; fallback?: boolean[]; tower?: boolean }): TileData {
  const road = {
    id: tx,
    kind: RoadKind.Secondary,
    width: 7,
    points: new Float32Array([0, 50, 100, 50]),
    startNode: tx,
    endNode: tx + 1,
    name: '',
    bridge: !!opts.deck,
    tunnel: false,
  };
  return {
    tx,
    tz: 0,
    size: 100,
    quant: { base: 0, step: 0.01 },
    lods: [],
    buildings: opts.tower
      ? [
          {
            id: 9,
            type: BuildingType.Church,
            roof: RoofShape.Gabled,
            wallHeight: 12,
            roofHeight: 8,
            levels: 1,
            outline: new Float32Array([10, 10, 40, 10, 40, 22, 10, 22]),
            estimated: false,
          },
        ]
      : [],
    roads: [road],
    land: [],
    waterways: [],
    details: {
      roads: [opts.deck ? detail(...opts.deck) : detail()],
      junctions: (opts.fallback ?? []).map((f, i) => ({ node: i, fallback: f, ring: new Float32Array(6) })),
      crossings: [],
      churchTowers: opts.tower ? [{ buildingId: 9, x: 14, z: 16, size: 6, rot: 0 }] : [],
      roundabouts: [],
    },
  };
}

const kandern = { x: 20, z: 20 };

describe('Prüfung Abschnitt 7', () => {
  it('gültige Welt besteht alle Prüfungen', () => {
    const tiles = [
      tile(0, { deck: [100, 101], fallback: [false, false, false, false, false, false, false, true], tower: true }),
      tile(1, { deck: [101, 100] }),
    ];
    const r = checkDetails(tiles, kandern);
    expect(r.messages.filter((m) => m.startsWith('✘'))).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('zu viele Kreuzungen im Rückfallmodus', () => {
    const r = checkDetails([tile(0, { fallback: [true, false, false, false], tower: true })], kandern);
    expect(r.ok).toBe(false);
  });

  it('Höhensprung an der Kachelgrenze wird erkannt', () => {
    const tiles = [tile(0, { deck: [100, 101], fallback: [false], tower: true }), tile(1, { deck: [101.5, 100] })];
    const r = checkDetails(tiles, kandern);
    expect(r.ok).toBe(false);
    expect(r.messages.some((m) => m.includes('Höhensprung 0.50'))).toBe(true);
  });

  it('fehlender Kirchturm in Kandern', () => {
    const r = checkDetails([tile(0, { fallback: [false] })], kandern);
    expect(r.ok).toBe(false);
  });
});
