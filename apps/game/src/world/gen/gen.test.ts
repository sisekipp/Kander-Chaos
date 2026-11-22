import { describe, expect, it } from 'vite-plus/test';
import {
  BuildingType,
  DEFAULT_HEIGHT_QUANT,
  LandKind,
  RoadKind,
  RoofShape,
  pointInRing,
  type TileData,
} from '@kandern/world-format';
import { buildTerrain } from './terrainGen.ts';
import { buildBuildings } from './buildings/index.ts';
import {
  SPECIES_COUNT,
  TreeSpecies,
  buildVegetation,
  poissonDisk,
  mulberry32,
  speciesFor,
  treeTint,
} from './vegetationGen.ts';
import { buildOccupancy } from './occupancy.ts';

function tile(): TileData {
  const samples = 33;
  const heights = new Uint16Array(samples * samples).fill(10000);
  return {
    tx: 2,
    tz: 5,
    size: 250,
    quant: DEFAULT_HEIGHT_QUANT,
    lods: [{ samples, heights }],
    buildings: [
      {
        id: 1e12 + 1,
        type: BuildingType.Residential,
        roof: RoofShape.Gabled,
        wallHeight: 6,
        roofHeight: 4,
        levels: 2,
        estimated: false,
        outline: new Float32Array([100, 100, 112, 100, 112, 108, 100, 108]),
      },
      {
        id: 1e12 + 2,
        type: BuildingType.HalfTimbered,
        roof: RoofShape.Hipped,
        wallHeight: 7,
        roofHeight: 4,
        levels: 2,
        estimated: false,
        outline: new Float32Array([130, 100, 145, 100, 145, 110, 130, 110]),
      },
      {
        id: 1e12 + 3,
        type: BuildingType.Commercial,
        roof: RoofShape.Flat,
        wallHeight: 7,
        roofHeight: 0,
        levels: 2,
        estimated: false,
        outline: new Float32Array([150, 150, 170, 150, 170, 160, 160, 160, 160, 175, 150, 175]),
      },
    ],
    roads: [
      {
        id: 1,
        kind: RoadKind.Residential,
        width: 6,
        points: new Float32Array([0, 50, 250, 50]),
        startNode: 1,
        endNode: 2,
        name: '',
        bridge: false,
        tunnel: false,
      },
    ],
    land: [{ kind: LandKind.ForestMixed, rings: [new Float32Array([0, 150, 120, 150, 120, 250, 0, 250])] }],
    waterways: [],
  };
}

describe('Gelände-Generator', () => {
  it('Gitter + Schürzen, Schürze liegt tiefer', () => {
    const g = buildTerrain(tile(), { lod: 0, skirtDepth: 5 });
    const n = 33;
    expect(g.positions.length / 3).toBe(n * n + 8 * n);
    expect(g.indices.length).toBe((n - 1) * (n - 1) * 6 + 4 * (n - 1) * 12);
    const groundY = g.positions[1];
    expect(g.positions[n * n * 3 + 1]).toBeCloseTo(groundY - 0.05);
    expect(g.positions[(n * n + n) * 3 + 1]).toBeCloseTo(groundY - 5);
    // Waldfarbe innerhalb der Waldfläche (dunkler Grünton)
    const k = 25 * n + 5; // x≈39, z≈195
    expect(g.colors[k * 4 + 1]).toBeLessThan(0.55);
  });
});

describe('Gebäude-Generator', () => {
  it('ist deterministisch und erzeugt Dächer', () => {
    const a = buildBuildings(tile(), { simple: false })!;
    const b = buildBuildings(tile(), { simple: false })!;
    expect([...a.positions]).toEqual([...b.positions]);
    expect([...a.colors]).toEqual([...b.colors]);
    let maxY = -Infinity;
    for (let i = 1; i < a.positions.length; i += 3) maxY = Math.max(maxY, a.positions[i]);
    // Boden 350 m + Wand + Dach; ein Schornstein darf bis 0,7 m über den First ragen
    expect(maxY).toBeGreaterThanOrEqual(350 + 7 + 4 - 0.01);
    expect(maxY).toBeLessThanOrEqual(350 + 7 + 4 + 0.71);
  });

  it('Wände zeigen nach außen (Normale weg vom Schwerpunkt)', () => {
    const t = tile();
    t.buildings = [t.buildings[0]];
    const g = buildBuildings(t, { simple: false })!;
    for (let v = 0; v < g.positions.length / 3; v++) {
      const ny = g.normals[v * 3 + 1];
      if (Math.abs(ny) > 0.01) continue; // nur Wände
      const dx = g.positions[v * 3] - 106,
        dz = g.positions[v * 3 + 2] - 104;
      expect(dx * g.normals[v * 3] + dz * g.normals[v * 3 + 2]).toBeGreaterThan(0);
    }
  });

  it('vereinfachte Blöcke haben keine Dachschrägen', () => {
    const g = buildBuildings(tile(), { simple: true })!;
    for (let v = 0; v < g.normals.length / 3; v++) {
      const ny = g.normals[v * 3 + 1];
      expect(Math.abs(ny) < 0.01 || Math.abs(ny - 1) < 1e-6).toBe(true);
    }
  });
});

describe('Vegetation', () => {
  it('Poisson-Disk hält Mindestabstand und ist deterministisch', () => {
    const a = poissonDisk(100, 5, mulberry32(1));
    const b = poissonDisk(100, 5, mulberry32(1));
    expect(a).toEqual(b);
    for (let i = 0; i < a.length; i += 2)
      for (let j = i + 2; j < a.length; j += 2) {
        expect(Math.hypot(a[i] - a[j], a[i + 1] - a[j + 1])).toBeGreaterThanOrEqual(5 - 1e-9);
      }
  });

  it('Waldbäume nur in der Waldfläche, nicht auf Straßen', () => {
    const t = tile();
    t.land.push({ kind: LandKind.Farmland, rings: [new Float32Array([130, 0, 250, 0, 250, 140, 130, 140])] });
    const occ = buildOccupancy(t);
    const v = buildVegetation(t, { density: 1, blocked: occ });
    const forest = t.land[0].rings[0];
    let inForest = 0;
    for (const m of v.matrices)
      for (let i = 0; i < m.length; i += 16) {
        const x = m[i + 12],
          z = m[i + 14];
        expect(pointInRing(x, z, t.land[1].rings[0])).toBe(false); // keine Bäume auf dem Acker
        expect(occ(x, z)).toBe(false);
        if (pointInRing(x, z, forest)) inForest++;
      }
    expect(inForest).toBeGreaterThan(200);
    const again = buildVegetation(t, { density: 1, blocked: occ });
    expect(again.counts).toEqual(v.counts);
  });

  it('Formauswahl je Landnutzung: Wälder gemischt mit Unterholz, Acker baumfrei, Obstwiese mit Obstbäumen', () => {
    const shares = (kind: LandKind | null) => {
      const c: number[] = Array.from({ length: SPECIES_COUNT }, () => 0);
      let none = 0;
      for (let i = 0; i < 1000; i++) {
        const sp = speciesFor(kind, (i + 0.5) / 1000);
        if (sp === null) none++;
        else c[sp]++;
      }
      return { c, none };
    };
    const conifer = shares(LandKind.ForestConiferous);
    expect(conifer.c[TreeSpecies.Conifer]).toBeGreaterThan(700);
    const deciduous = shares(LandKind.ForestDeciduous);
    expect(deciduous.c[TreeSpecies.Deciduous]).toBeGreaterThan(500);
    expect(deciduous.c[TreeSpecies.Tall]).toBeGreaterThan(100);
    expect(deciduous.c[TreeSpecies.Bush]).toBeGreaterThan(50);
    expect(shares(LandKind.Farmland).none).toBe(1000);
    const orchard = shares(LandKind.Orchard);
    expect(orchard.c[TreeSpecies.Fruit]).toBe(450);
    expect(orchard.c[TreeSpecies.Conifer]).toBe(0);
    expect(shares(LandKind.Residential).c[TreeSpecies.Conifer]).toBe(0);
  });

  it('Farbtönung je Baum bleibt im Rahmen', () => {
    for (const [a, b] of [
      [0, 0],
      [1, 1],
      [0.5, 0.2],
    ]) {
      const t = treeTint(a, b);
      for (const v of t) {
        expect(v).toBeGreaterThan(0.75);
        expect(v).toBeLessThan(1.25);
      }
    }
  });
});
