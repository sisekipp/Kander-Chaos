import { describe, expect, it } from 'vite-plus/test';
import { GeoBuilder } from '../gen/GeoBuilder.ts';
import { RoadCode } from './profile.ts';
import { ZEBRA_WIDTH, addCrossing, addJunction } from './junctionMesh.ts';

function area(g: NonNullable<ReturnType<GeoBuilder['build']>>): number {
  const p = g.positions;
  let a = 0;
  for (let t = 0; t < g.indices.length; t += 3) {
    const [i, j, k] = [g.indices[t], g.indices[t + 1], g.indices[t + 2]];
    a +=
      Math.abs(
        (p[j * 3] - p[i * 3]) * (p[k * 3 + 2] - p[i * 3 + 2]) - (p[k * 3] - p[i * 3]) * (p[j * 3 + 2] - p[i * 3 + 2]),
      ) / 2;
  }
  return a;
}

describe('Kreuzungs- und Zebrastreifen-Geometrie', () => {
  it('Kreuzungspolygon wird vollständig trianguliert (Fläche bleibt gleich, auch konkav)', () => {
    const g = new GeoBuilder(true);
    // L-förmiges (konkaves) Polygon, 10×10 minus 5×5
    const ring = new Float32Array([0, 0, 10, 0, 10, 5, 5, 5, 5, 10, 0, 10]);
    const tris = addJunction(g, { node: 1, fallback: false, ring }, () => 200);
    const b = g.build()!;
    expect(tris).toBe(4);
    expect(area(b)).toBeCloseTo(75);
    expect(b.uvs2![0]).toBe(RoadCode.Junction);
    for (let v = 0; v < b.positions.length / 3; v++) expect(b.normals[v * 3 + 1]).toBeCloseTo(1);
  });

  it('Kreuzung sinkt am Hang nicht unter die Knotenhöhe', () => {
    const g = new GeoBuilder(true);
    addJunction(g, { node: 1, fallback: false, ring: new Float32Array([0, 0, 10, 0, 10, 10, 0, 10]) }, (x) => 200 - x);
    const b = g.build()!;
    for (let v = 0; v < b.positions.length / 3; v++) expect(b.positions[v * 3 + 1]).toBeGreaterThanOrEqual(195);
  });

  it('Zebrastreifen: Rechteck Fahrbahnbreite × 3 m, quer zur Straße ausgerichtet', () => {
    const g = new GeoBuilder(true);
    // Straße läuft nach Osten, Fußgänger gehen nach Norden
    addCrossing(g, { x: 50, z: 20, dirX: 0, dirZ: 1, length: 7 }, () => 100);
    const b = g.build()!;
    const xs = Array.from({ length: b.positions.length / 3 }, (_, i) => b.positions[i * 3]);
    const zs = Array.from({ length: b.positions.length / 3 }, (_, i) => b.positions[i * 3 + 2]);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(7);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(ZEBRA_WIDTH);
    expect(b.uvs2![0]).toBe(RoadCode.Zebra);
    expect(b.positions[1]).toBeGreaterThan(100);
  });
});
