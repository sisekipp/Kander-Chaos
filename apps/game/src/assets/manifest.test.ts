import { describe, expect, it } from 'vite-plus/test';
import { modelsOfKind, parseManifest, vehicleModels } from './manifest.ts';

const car = (id: string, vehicleKind: 0 | 1 | 2 = 0) => ({
  id,
  kind: 'vehicle',
  file: `${id}.glb`,
  bytes: 1000,
  triangles: 2000,
  zones: ['paint'],
  parts: ['detach_a', 'detach_b'],
  vehicle: {
    vehicleKind,
    type: 'Kleinwagen',
    box: [1.7, 1.3, 3.8],
    center: [0, 0.8, 0],
    wheels: [
      { name: 'w1', x: 0.5, y: 0.4, z: 1, radius: 0.4 },
      { name: 'w2', x: -0.5, y: 0.4, z: 1, radius: 0.4 },
    ],
  },
});

describe('Modell-Manifest', () => {
  it('liest Einträge, sortiert stabil nach ID und filtert nach Art', () => {
    const m = parseManifest({
      version: 1,
      models: [car('van'), car('bike', 1), { id: 'bank', kind: 'prop', file: 'bank.glb' }],
    });
    expect(m.models.map((e) => e.id)).toEqual(['bank', 'bike', 'van']);
    expect(vehicleModels(m, 0).map((e) => e.id)).toEqual(['van']);
    expect(modelsOfKind(m, 'prop')[0].zones).toEqual([]);
  });

  it('lehnt unbekannte Versionen und unvollständige Einträge ab', () => {
    expect(() => parseManifest({ version: 2, models: [] })).toThrow();
    expect(() => parseManifest({ version: 1, models: [{ id: 'x', kind: 'rakete', file: 'x.glb' }] })).toThrow();
    expect(() =>
      parseManifest({ version: 1, models: [{ ...car('x'), vehicle: { ...car('x').vehicle, wheels: [] } }] }),
    ).toThrow();
  });
});
