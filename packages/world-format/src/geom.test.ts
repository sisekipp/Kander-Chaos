import { describe, expect, it } from 'vite-plus/test';
import {
  centroid,
  clipPolylineToRect,
  clipRingToRect,
  distanceToRing,
  ensureCCW,
  orientedRect,
  pointInRing,
  signedArea,
} from './geom.ts';

const square = [0, 0, 10, 0, 10, 10, 0, 10];

describe('Geometrie', () => {
  it('Fläche, Orientierung, Schwerpunkt', () => {
    expect(signedArea(square)).toBe(100);
    expect(signedArea(ensureCCW([0, 0, 0, 10, 10, 10, 10, 0]))).toBe(100);
    expect(centroid(square)).toEqual([5, 5]);
  });

  it('Punkt im Polygon und Randabstand', () => {
    expect(pointInRing(5, 5, square)).toBe(true);
    expect(pointInRing(15, 5, square)).toBe(false);
    expect(distanceToRing(15, 5, square)).toBe(5);
  });

  it('orientiertes Rechteck eines gedrehten Rechtecks', () => {
    const c = Math.cos(0.5),
      s = Math.sin(0.5);
    const rect = [-6, -3, 6, -3, 6, 3, -6, 3].flatMap((_, i, a) =>
      i % 2 ? [] : [a[i] * c - a[i + 1] * s, a[i] * s + a[i + 1] * c],
    );
    const o = orientedRect(rect);
    expect(o.halfLong).toBeCloseTo(6);
    expect(o.halfShort).toBeCloseTo(3);
    expect(o.fill).toBeCloseTo(1);
    expect(Math.abs(o.ux * c + o.uz * s)).toBeCloseTo(1);
  });

  it('L-Form hat Füllgrad < 1', () => {
    const l = [0, 0, 10, 0, 10, 4, 4, 4, 4, 10, 0, 10];
    expect(orientedRect(l).fill).toBeCloseTo(0.64);
  });

  it('Ring-Zuschnitt', () => {
    const clipped = clipRingToRect(square, 5, -1, 20, 20);
    expect(Math.abs(signedArea(clipped))).toBeCloseTo(50);
    expect(clipRingToRect(square, 20, 20, 30, 30)).toHaveLength(0);
  });

  it('Linien-Zuschnitt mit identischen Schnittpunkten in Nachbarkacheln', () => {
    const line = [-5, 1, 15, 3];
    const a = clipPolylineToRect(line, -10, 0, 10, 10);
    const b = clipPolylineToRect(line, 10, 0, 30, 10);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(a[0].startCut).toBe(-1);
    expect(a[0].endCut).toBe(0);
    expect(b[0].startCut).toBe(0);
    expect(b[0].endCut).toBe(-1);
    expect(a[0].points.slice(-2)).toEqual(b[0].points.slice(0, 2));
  });
});
