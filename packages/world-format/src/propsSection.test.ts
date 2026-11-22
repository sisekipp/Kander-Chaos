import { describe, expect, it } from 'vite-plus/test';
import { decodeTile, encodeTile } from './tile.ts';
import { makeTile } from './testFixtures.ts';
import { FORMAT_VERSION, PropKind, VehicleKind } from './types.ts';

describe('Abschnitt 6 – Props', () => {
  const tile = {
    ...makeTile(),
    props: [
      { kind: PropKind.Lamp, variant: 0, x: 10.5, z: 20.25, rot: 1.5 },
      { kind: PropKind.Fence, variant: 2, x: 0, z: 249, rot: -0.5 },
    ],
    parking: [{ id: 3e12 + 17, kind: VehicleKind.Bike, x: 40, z: 41, heading: 3 }],
  };

  it('Round-Trip von Kleinobjekten und Parkpositionen', () => {
    const d = decodeTile(encodeTile(tile));
    expect(d.props).toHaveLength(2);
    expect(d.props![0]).toMatchObject({ kind: PropKind.Lamp, variant: 0, x: 10.5, z: 20.25 });
    expect(d.props![0].rot).toBeCloseTo(1.5);
    expect(d.parking).toEqual([{ id: 3e12 + 17, kind: VehicleKind.Bike, x: 40, z: 41, heading: 3 }]);
  });

  it('Kacheln ohne Props bleiben bytegleich zum alten Format', () => {
    const old = encodeTile(makeTile());
    expect(encodeTile({ ...makeTile(), props: [], parking: [] })).toEqual(old);
    expect(decodeTile(old).props).toEqual([]);
  });

  it('Leser ohne Props-Unterstützung lesen die übrigen Abschnitte weiter (unbekannter Abschnitt wird übersprungen)', () => {
    // Simuliert einen alten Leser: Abschnitt 6 durch eine unbekannte Kennung ersetzen
    const bytes = encodeTile(tile);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let pos = 4 + 2 + 4 + 4 + 4 + 4 + 4; // Kopf
    while (pos < bytes.length) {
      const id = view.getUint16(pos, true);
      const len = view.getUint32(pos + 2, true);
      if (id === 6) view.setUint16(pos, 999, true);
      pos += 6 + len;
    }
    const d = decodeTile(bytes);
    expect(d.props).toEqual([]);
    expect(d.buildings).toHaveLength(1);
    expect(d.roads[0].name).toBe('Hauptstraße');
    expect(d.lods[0].samples).toBe(5);
    expect(FORMAT_VERSION).toBe(1);
  });

  it('Props-Abschnitt steht hinter allen alten Abschnitten', () => {
    const bytes = encodeTile(tile);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let pos = 26; // Kopf: Kennung, Version, tx, tz, size, quant.base, quant.step
    const ids: number[] = [];
    while (pos < bytes.length) {
      ids.push(view.getUint16(pos, true));
      pos += 6 + view.getUint32(pos + 2, true);
    }
    expect(ids).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
