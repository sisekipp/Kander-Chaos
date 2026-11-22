import { describe, expect, it } from 'vite-plus/test';
import { Surface, type TileDetails } from './detailsSection.ts';
import { decodeTile, encodeTile } from './tile.ts';
import { makeTile } from './testFixtures.ts';
import { PropKind } from './types.ts';

const details: TileDetails = {
  roads: [
    {
      lanes: 2,
      oneway: false,
      sidewalkLeft: true,
      sidewalkRight: false,
      surface: Surface.Paving,
      layer: -2,
      trimStart: 3.5,
      trimEnd: 0,
      deckStart: 312.25,
      deckEnd: 313.5,
    },
  ],
  junctions: [{ node: 9_876_543_210, fallback: true, ring: new Float32Array([0, 0, 4, 0, 4, 4, 0, 4]) }],
  crossings: [{ x: 12, z: 125, dirX: 0, dirZ: 1, length: 7 }],
  churchTowers: [{ buildingId: 1_000_000_000_000 + 5, x: 30, z: 40, size: 6, rot: 0.5 }],
  roundabouts: [{ x: 100, z: 120, radius: 12.5, width: 7 }],
};

/** Ersetzt die Kennung eines Abschnitts (simuliert einen Leser, der ihn nicht kennt). */
function hideSection(bytes: Uint8Array, id: number): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 4 + 2 + 4 + 4 + 4 + 4 + 4;
  while (pos < bytes.length) {
    const len = view.getUint32(pos + 2, true);
    if (view.getUint16(pos, true) === id) view.setUint16(pos, 999, true);
    pos += 6 + len;
  }
}

describe('Abschnitt 7 – Details', () => {
  it('Round-Trip aller Detailarten', () => {
    const d = decodeTile(encodeTile({ ...makeTile(), details })).details!;
    expect(d.roads).toHaveLength(1);
    expect(d.roads[0]).toMatchObject({ lanes: 2, sidewalkLeft: true, sidewalkRight: false, layer: -2, trimStart: 3.5 });
    expect(d.roads[0].surface).toBe(Surface.Paving);
    expect(d.roads[0].deckEnd).toBeCloseTo(313.5);
    expect(d.junctions[0].node).toBe(9_876_543_210);
    expect(d.junctions[0].fallback).toBe(true);
    expect(Array.from(d.junctions[0].ring)).toEqual([0, 0, 4, 0, 4, 4, 0, 4]);
    expect(d.crossings).toEqual(details.crossings);
    expect(d.churchTowers).toEqual(details.churchTowers);
    expect(d.roundabouts).toEqual(details.roundabouts);
  });

  it('Kreisverkehr-Kennzeichen je Straße', () => {
    const rb = { ...details, roads: [{ ...details.roads[0], roundabout: true }] };
    expect(decodeTile(encodeTile({ ...makeTile(), details: rb })).details!.roads[0].roundabout).toBe(true);
  });

  it('NaN als Deckhöhe bleibt NaN (keine Brücke)', () => {
    const noBridge = { ...details, roads: [{ ...details.roads[0], deckStart: NaN, deckEnd: NaN }] };
    const d = decodeTile(encodeTile({ ...makeTile(), details: noBridge })).details!;
    expect(Number.isNaN(d.roads[0].deckStart)).toBe(true);
  });

  it('leere Details erzeugen keinen Abschnitt (bytegleich zum alten Format)', () => {
    const old = encodeTile(makeTile());
    expect(
      encodeTile({
        ...makeTile(),
        details: { roads: [], junctions: [], crossings: [], churchTowers: [], roundabouts: [] },
      }),
    ).toEqual(old);
    expect(decodeTile(old).details).toBeUndefined();
  });

  it('wirft, wenn die Anzahl der Straßenattribute nicht passt', () => {
    expect(() =>
      encodeTile({ ...makeTile(), details: { ...details, roads: [details.roads[0], details.roads[0]] } }),
    ).toThrow();
  });

  it('Leser ohne Abschnitt 7 liest den Rest korrekt', () => {
    const tile = { ...makeTile(), props: [{ kind: PropKind.Bench, variant: 1, x: 5, z: 6, rot: 0 }], details };
    const bytes = encodeTile(tile);
    hideSection(bytes, 7);
    const d = decodeTile(bytes);
    expect(d.details).toBeUndefined();
    expect(d.roads[0].name).toBe('Hauptstraße');
    expect(d.buildings).toHaveLength(1);
    expect(d.props).toHaveLength(1);
  });
});
