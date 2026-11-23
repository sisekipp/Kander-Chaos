import { describe, expect, it } from 'vite-plus/test';
import { BuildingType, RoofShape, type Building } from '@kandern/world-format';
import {
  localFootprint,
  missingOverrides,
  osmIdOf,
  selectLandmarks,
  styleOf,
  type RawLandmarkBuilding,
} from './select.ts';

const building = (id: number): Building => ({
  id,
  type: BuildingType.Church,
  roof: RoofShape.Gabled,
  wallHeight: 10,
  roofHeight: 6,
  levels: 1,
  outline: new Float32Array(),
  estimated: true,
});

/** Rechteck 30 × 12 m, um 90° gedreht (Längsachse entlang z), Mitte (100, 200). */
const rect = [94, 185, 106, 185, 106, 215, 94, 215];

describe('styleOf', () => {
  it('erkennt Kirche, Kapelle, Rathaus, Schule, Bahnhof, Supermarkt, Feuerwehr', () => {
    expect(styleOf({ building: 'church' }, 400)).toBe('church');
    expect(styleOf({ building: 'church' }, 80)).toBe('chapel');
    expect(styleOf({ building: 'yes', name: 'Altes Rathaus' }, 200)).toBe('townhall');
    expect(styleOf({ building: 'school' }, 900)).toBe('school');
    expect(styleOf({ building: 'train_station' }, 120)).toBe('station');
    expect(styleOf({ building: 'retail', shop: 'supermarket' }, 1100)).toBe('supermarket');
    expect(styleOf({ building: 'yes', amenity: 'fire_station' }, 300)).toBe('fire_station');
  });

  it('normale Wohnhäuser sind keine Wahrzeichen', () => {
    expect(styleOf({ building: 'house' }, 120)).toBeNull();
    expect(styleOf({ building: 'yes' }, 120)).toBeNull();
  });
});

describe('selectLandmarks', () => {
  const raw: RawLandmarkBuilding[] = [
    { id: 1e12 + 42, tags: { building: 'church', name: 'St. Test' }, outline: rect },
    { id: 1e12 + 43, tags: { building: 'house' }, outline: rect },
    { id: 1e12 + 44, tags: { building: 'yes' }, outline: rect },
  ];
  const placed = new Map(raw.map((r) => [r.id, building(r.id)]));

  it('wählt nach Art aus, übernimmt Höhen und Überschreibungen nach OSM-ID', () => {
    const lm = selectLandmarks(raw, placed, { '44': { id: 'rathaus-x', name: 'Rathaus X', style: 'townhall' } });
    expect(lm.map((l) => l.id)).toEqual(['church-st-test', 'rathaus-x']);
    const church = lm[0];
    expect(church).toMatchObject({ style: 'church', buildingId: 1e12 + 42, x: 100, z: 200, wallHeight: 10 });
    expect(osmIdOf(church.buildingId!)).toBe(42);
  });

  it('Grundriss im Modellsystem: Längsachse entlang lx, Mitte im Ursprung', () => {
    const [l] = selectLandmarks(raw.slice(0, 1), placed, {});
    const xs = l.footprint.filter((_, i) => i % 2 === 0);
    const zs = l.footprint.filter((_, i) => i % 2 === 1);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(30);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(12);
    // zurück in Weltkoordinaten: Mitte + lx·u + lz·(−uz, ux)
    const wx = l.x + l.footprint[0] * l.ux - l.footprint[1] * l.uz;
    const wz = l.z + l.footprint[0] * l.uz + l.footprint[1] * l.ux;
    expect(rect.some((v, i) => i % 2 === 0 && Math.abs(v - wx) < 0.05 && Math.abs(rect[i + 1] - wz) < 0.05)).toBe(true);
  });

  it('Extras ohne Gebäude und eindeutige IDs', () => {
    const lm = selectLandmarks(raw.slice(0, 1), placed, { '42': { id: 'x' } }, [
      { id: 'x', name: 'Burg', style: 'ruin', x: 5, z: 6, size: [30, 50] },
    ]);
    expect(lm.map((l) => l.id).sort()).toEqual(['x', 'x-2']);
    const burg = lm.find((l) => l.style === 'ruin')!;
    expect(burg.buildingId).toBeNull();
    expect(Math.max(...burg.footprint)).toBe(25);
  });

  it('Bodenhöhe = tiefster Punkt unter Mitte und Ecken', () => {
    const [l] = selectLandmarks(raw.slice(0, 1), placed, {}, [], (x, z) => x / 10 + z / 100);
    // Ecken bei x = 94 … 106, z = 185 … 215 -> Minimum bei (94, 185)
    expect(l.ground).toBeCloseTo(9.4 + 1.85);
  });

  it('localFootprint dreht in die Längsachse', () => {
    expect(localFootprint([10, 0, 0, 10], 0, 0, 0, 1)).toEqual([0, -10, 10, 0]);
  });
});

describe('Wahrzeichen der Region', () => {
  const raw: RawLandmarkBuilding[] = [{ id: 1e12 + 7, tags: { building: 'office' }, outline: rect }];
  const placed = new Map(raw.map((r) => [r.id, building(r.id)]));

  it('Treffer per OSM-ID übernimmt Sollhöhe, Größe und Region', () => {
    const [l] = selectLandmarks(raw, placed, {
      '7': { id: 'roche', name: 'Roche', style: 'tower', height: 205, large: true, region: true },
    });
    expect(l).toMatchObject({ id: 'roche', style: 'tower', height: 205, large: true, region: true });
  });

  it('freies Wahrzeichen: Koordinate und Ausrichtung (0° = Norden = +z)', () => {
    const [l] = selectLandmarks([], new Map(), {}, [
      { id: 'flugzeug', name: 'F', style: 'airplane', x: 10, z: 20, size: [30, 40], heading: 0, region: true },
    ]);
    expect(l).toMatchObject({ x: 10, z: 20, ux: 0, uz: 1, buildingId: null, region: true });
    const [e] = selectLandmarks([], new Map(), {}, [
      { id: 'b', name: 'B', style: 'bridge', x: 0, z: 0, size: [8, 20], heading: 90 },
    ]);
    expect(e.ux).toBeCloseTo(1);
    expect(e.region).toBeUndefined();
  });

  it('fehlende OSM-ID wird gemeldet', () => {
    const ov = { '7': { style: 'tower' as const }, '999': { style: 'tower' as const } };
    expect(missingOverrides(ov, selectLandmarks(raw, placed, ov))).toEqual(['999']);
  });
});
