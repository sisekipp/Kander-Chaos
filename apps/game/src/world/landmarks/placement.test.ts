import { describe, expect, it } from 'vite-plus/test';
import { groundFor, rotationY, tileOfLandmark, toWorld, type LandmarkInfo } from './placement.ts';

const lm = (ux: number, uz: number): LandmarkInfo => ({
  id: 'x',
  name: 'X',
  style: 'church',
  detail: null,
  buildingId: 1,
  x: 100,
  z: 200,
  ux,
  uz,
  footprint: [-15, -6, 15, -6, 15, 6, -15, 6],
  wallHeight: 10,
  roofHeight: 6,
  levels: 1,
});

/** Babylon-Drehung um y wie Matrix.RotationY. */
const rotate = (x: number, z: number, t: number) => [
  x * Math.cos(t) + z * Math.sin(t),
  -x * Math.sin(t) + z * Math.cos(t),
];

describe('Wahrzeichen-Platzierung', () => {
  it('Drehung und toWorld stimmen überein (Längsachse auf u, Querachse auf (−uz, ux))', () => {
    for (const a of [0, 0.7, 2.1, -1.3]) {
      const l = lm(Math.cos(a), Math.sin(a));
      const t = rotationY(l);
      for (const [lx, lz] of [
        [15, 0],
        [0, 6],
        [-15, 6],
      ]) {
        const [rx, rz] = rotate(lx, lz, t);
        const [wx, wz] = toWorld(l, lx, lz);
        expect(rx + l.x).toBeCloseTo(wx);
        expect(rz + l.z).toBeCloseTo(wz);
      }
    }
  });

  it('Bodenhöhe = tiefster Punkt unter Mitte und Ecken; ohne Gelände null', () => {
    const l = lm(1, 0);
    expect(groundFor(l, (x) => x / 10)).toBeCloseTo(8.5);
    expect(groundFor(l, () => null)).toBeNull();
  });

  it('Kachel nach der Mitte', () => {
    expect(tileOfLandmark(lm(1, 0), 250)).toBe('0,0');
    expect(tileOfLandmark({ ...lm(1, 0), x: -10, z: 260 }, 250)).toBe('-1,1');
  });
});
