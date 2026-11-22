import { describe, expect, it } from 'vite-plus/test';
import {
  DEFAULT_HEIGHT_QUANT,
  RoadKind,
  Surface,
  emptyDetails,
  type RoadDetail,
  type TileData,
} from '@kandern/world-format';
import { RoadCode } from './profile.ts';
import { buildRoadGeometry } from './roadGeometry.ts';

const detail = (o: Partial<RoadDetail> = {}): RoadDetail => ({
  lanes: 2,
  oneway: false,
  sidewalkLeft: true,
  sidewalkRight: true,
  surface: Surface.Asphalt,
  layer: 0,
  trimStart: 0,
  trimEnd: 0,
  deckStart: NaN,
  deckEnd: NaN,
  ...o,
});

function tile(withDetails: boolean): TileData {
  const samples = 33;
  const road = (id: number, points: number[], bridge = false, tunnel = false) => ({
    id,
    kind: RoadKind.Residential,
    width: 6,
    points: new Float32Array(points),
    startNode: id,
    endNode: id + 1,
    name: '',
    bridge,
    tunnel,
  });
  const t: TileData = {
    tx: 0,
    tz: 0,
    size: 250,
    quant: DEFAULT_HEIGHT_QUANT,
    lods: [{ samples, heights: new Uint16Array(samples * samples).fill(10000) }], // 350 m
    buildings: [],
    roads: [road(1, [0, 50, 250, 50]), road(10, [0, 150, 100, 150], true), road(20, [0, 200, 100, 200], false, true)],
    land: [],
    waterways: [{ kind: 'stream', width: 2, name: '', points: new Float32Array([0, 100, 250, 100]) }],
  };
  if (withDetails) {
    t.details = emptyDetails();
    t.details.roads = [detail({ trimEnd: 10 }), detail({ deckStart: 360, deckEnd: 360 }), detail()];
    t.details.junctions = [{ node: 2, fallback: false, ring: new Float32Array([240, 40, 250, 40, 250, 60, 240, 60]) }];
    t.details.crossings = [{ x: 120, z: 50, dirX: 0, dirZ: 1, length: 6 }];
  }
  return t;
}

const codesOf = (uvs2: Float32Array) => new Set(Array.from({ length: uvs2.length / 2 }, (_, i) => uvs2[i * 2]));

describe('Straßen-Geometrie der Kachel', () => {
  it('alle Straßenteile in einem Mesh: Fahrbahn, Gehweg, Bordstein, Kreuzung, Zebrastreifen, Brücke, Portal', () => {
    const { roads } = buildRoadGeometry(tile(true), { simple: false });
    const codes = codesOf(roads!.uvs2!);
    for (const c of [
      RoadCode.AsphaltMinor,
      RoadCode.Sidewalk,
      RoadCode.Curb,
      RoadCode.Junction,
      RoadCode.Zebra,
      RoadCode.Concrete,
    ])
      expect(codes.has(c), `Code ${c}`).toBe(true);
    // Gewässer haben ein eigenes Mesh (water/)
    expect(codes.has(RoadCode.Water)).toBe(false);
  });

  it('Fahrflächen liegen über dem Gelände (Pfeiler und Portale reichen bewusst hinein)', () => {
    const { roads } = buildRoadGeometry(tile(true), { simple: false });
    const p = roads!.positions,
      c = roads!.uvs2!;
    for (let v = 0; v < p.length / 3; v++)
      if (c[v * 2] !== RoadCode.Concrete) expect(p[v * 3 + 1]).toBeGreaterThan(350);
  });

  it('Brückenfahrbahn getrennt für die Kollision, auf Deckhöhe', () => {
    const { bridges } = buildRoadGeometry(tile(true), { simple: false });
    expect(bridges).not.toBeNull();
    for (let i = 1; i < bridges!.positions.length; i += 3) expect(bridges!.positions[i]).toBeCloseTo(360.13, 1);
  });

  it('Tunnel: keine Fahrbahn, nur Portale', () => {
    const t = tile(true);
    t.roads = [t.roads[2]];
    t.details!.roads = [detail()];
    t.details!.junctions = [];
    t.details!.crossings = [];
    t.waterways = [];
    const { roads } = buildRoadGeometry(t, { simple: false });
    expect(codesOf(roads!.uvs2!)).toEqual(new Set([RoadCode.Concrete]));
  });

  it('ältere Kacheln ohne Abschnitt 7 werden weiter gezeichnet', () => {
    const { roads, bridges } = buildRoadGeometry(tile(false), { simple: false });
    expect(roads!.positions.length).toBeGreaterThan(0);
    expect(bridges).toBeNull();
  });
});
