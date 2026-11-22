import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildPack, buildWorldIndex, tileId, type BuiltPack, type TileData } from '@kandern/world-format';
import { config } from './config.ts';
import { projectToWorld, studyAreaFromBoundary, tilesOf } from './area.ts';
import { rawPaths } from './fetch.ts';
import { DgmGrid } from './dgm.ts';
import {
  assembleRings,
  stableId,
  wayRing,
  type LatLon,
  type OsmNode,
  type OsmRelation,
  type OsmWay,
  type OverpassResult,
} from './osm.ts';
import { placeBuildings, type RawBuilding } from './buildings.ts';
import { roadsPerTile, splitAtJunctions, type RawWay } from './roads/network.ts';
import { settlementLookup } from './roads/attributes.ts';
import { addDetailsToTiles } from './roads/details.ts';
import type { RoadPart } from './roads/network.ts';
import { landKind, landPerTile, waterwayKind, waterwaysPerTile, type RawArea, type RawWaterway } from './landuse.ts';
import { buildTerrainLods } from './terrain.ts';
import { buildAttribution } from './attribution.ts';
import { addPropsToTiles, readOsmProps } from './props/index.ts';

const log = (...a: unknown[]) => console.log('[build]', ...a);

export interface Place {
  name: string;
  kind: string;
  x: number;
  z: number;
}

export interface BuildResult {
  tiles: TileData[];
  places: Place[];
  outDir: string;
}

const CORE_RADIUS: Record<string, number> = { town: 320, village: 170, suburb: 140, hamlet: 80 };

function geometryToWorld(geom: (LatLon | null)[]): number[] | null {
  const out: number[] = [];
  for (const g of geom) {
    if (!g) return null;
    const [x, z] = projectToWorld(g);
    out.push(x, z);
  }
  return out;
}

/** Baut alle Kacheln aus den Rohdaten. `outDir` = Zielordner (Standard: apps/game/public/world). */
export async function runBuild(outDir = config.paths.out): Promise<BuildResult> {
  for (const f of [rawPaths.boundary(), rawPaths.osm(), rawPaths.dgmGrid()]) {
    if (!existsSync(f)) throw new Error(`Rohdaten fehlen: ${f} – zuerst "fetch" ausführen`);
  }
  const area = studyAreaFromBoundary(JSON.parse(await readFile(rawPaths.boundary(), 'utf8')) as OverpassResult);
  const tileList = tilesOf(area);
  const included = new Set(tileList.map((t) => tileId(t.tx, t.tz)));
  const includes = (tx: number, tz: number) => included.has(tileId(tx, tz));
  log(`${tileList.length} Kacheln à ${config.tileSize} m`);

  log('lese OSM-Daten …');
  const osm = JSON.parse(await readFile(rawPaths.osm(), 'utf8')) as OverpassResult;
  const osmDate = (osm.osm3s?.timestamp_osm_base ?? '1970-01-01').slice(0, 10);
  const grid = DgmGrid.deserialize(await readFile(rawPaths.dgmGrid()));
  const height = (x: number, z: number) => grid.sample(config.origin.easting + x, config.origin.northing + z);

  // Orte (für Ortskerne, Abdeckungsprüfung und Startpunkt)
  const places: Place[] = osm.elements
    .filter((e): e is OsmNode => e.type === 'node' && !!e.tags?.place && !!e.tags?.name)
    .map((n) => {
      const [x, z] = projectToWorld(n);
      return { name: n.tags!.name, kind: n.tags!.place, x, z };
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.x - b.x);
  const cores = places.filter((p) => CORE_RADIUS[p.kind]);
  const coreFactorAt = (x: number, z: number) => {
    let f = 0;
    for (const c of cores) f = Math.max(f, 1 - Math.hypot(x - c.x, z - c.z) / CORE_RADIUS[c.kind]);
    return f;
  };

  // Elemente einsortieren
  const rawBuildings: RawBuilding[] = [];
  const rawWays: RawWay[] = [];
  const rawAreas: RawArea[] = [];
  const rawWater: RawWaterway[] = [];
  for (const el of osm.elements) {
    const tags = el.tags ?? {};
    if (el.type === 'way') {
      const w = el as OsmWay;
      if (tags.building && tags.building !== 'no') {
        const ring = wayRing(w, projectToWorld);
        if (ring) rawBuildings.push({ id: stableId(w), tags, outline: ring.flat() });
        continue;
      }
      if (tags.highway || tags.railway) {
        const coords = geometryToWorld(w.geometry);
        if (coords && coords.length >= 4) rawWays.push({ id: w.id, nodes: w.nodes, coords, tags });
      }
      const lk = landKind(tags);
      if (lk !== null) {
        const ring = wayRing(w, projectToWorld);
        if (ring) rawAreas.push({ id: stableId(w), kind: lk, outers: [ring.flat()], inners: [] });
      }
      const wk = waterwayKind(tags);
      if (wk) {
        const coords = geometryToWorld(w.geometry);
        if (coords) rawWater.push({ id: w.id, ...wk, name: tags.name ?? '', coords });
      }
    } else if (el.type === 'relation') {
      const r = el as OsmRelation;
      if (tags.type !== 'multipolygon' && tags.type !== 'building') continue;
      const outers = assembleRings(r.members, 'outer', projectToWorld).map((x) => x.flat());
      if (outers.length === 0) continue;
      if (tags.building && tags.building !== 'no') {
        outers.forEach((o, k) => rawBuildings.push({ id: stableId(r) + k * 1e-3, tags, outline: o }));
        continue;
      }
      const lk = landKind(tags);
      if (lk !== null) {
        const inners = assembleRings(r.members, 'inner', projectToWorld).map((x) => x.flat());
        rawAreas.push({ id: stableId(r), kind: lk, outers, inners });
      }
    }
  }
  log(
    `${rawBuildings.length} Gebäude, ${rawWays.length} Wege, ${rawAreas.length} Flächen, ${rawWater.length} Gewässer, ${places.length} Orte`,
  );

  // Je Kachel verteilen
  const buildingsByTile = new Map<string, TileData['buildings']>();
  let estimated = 0;
  for (const pb of placeBuildings(rawBuildings, config.tileSize, coreFactorAt)) {
    const key = tileId(pb.tx, pb.tz);
    if (!included.has(key)) continue;
    if (pb.building.estimated) estimated++;
    let list = buildingsByTile.get(key);
    if (!list) buildingsByTile.set(key, (list = []));
    list.push(pb.building);
  }
  const roadParts = new Map<string, RoadPart[]>();
  const pieces = splitAtJunctions(rawWays, settlementLookup(rawAreas));
  const roads = roadsPerTile(pieces, config.tileSize, includes, roadParts);
  const land = landPerTile(rawAreas, config.tileSize, includes);
  const water = waterwaysPerTile(rawWater, config.tileSize, includes);

  log('erzeuge Gelände-LODs …');
  const tiles: TileData[] = tileList.map(({ tx, tz }) => {
    const key = tileId(tx, tz);
    return {
      tx,
      tz,
      size: config.tileSize,
      quant: config.quant,
      lods: buildTerrainLods(height, tx, tz, config.tileSize, config.lodSamples, config.quant),
      buildings: buildingsByTile.get(key) ?? [],
      roads: roads.get(key) ?? [],
      land: land.get(key) ?? [],
      waterways: water.get(key) ?? [],
    };
  });
  let zebras: { x: number; z: number }[] = [];
  let towerParts: number[][] = [];
  if (existsSync(rawPaths.osmProps())) {
    const osmProps = readOsmProps(
      JSON.parse(await readFile(rawPaths.osmProps(), 'utf8')) as OverpassResult,
      projectToWorld,
    );
    const n = addPropsToTiles(tiles, osmProps);
    log(`${n.props} Kleinobjekte (${osmProps.props.length} aus OSM), ${n.parking} Parkpositionen`);
    zebras = osmProps.zebras;
    towerParts = osmProps.towerParts;
  } else log('keine Props-Rohdaten (osm-props.json) – Kacheln ohne Kleinobjekte');
  const ds = addDetailsToTiles(tiles, { pieces, parts: roadParts, ground: height, zebras, towerParts });
  log(
    `${ds.junctions} Kreuzungen (${ds.fallback} Rückfall), ${ds.bridges} Brückenteilstücke, ${ds.crossings} Zebrastreifen, ${ds.towers} Kirchtürme, ${ds.roundabouts} Kreisverkehre`,
  );
  const nb = tiles.reduce((s, t) => s + t.buildings.length, 0);
  log(`${nb} Gebäude in der Welt, davon ${estimated} mit geschätzten Werten`);

  // Regionspakete
  const regions = new Map<string, TileData[]>();
  for (const t of tiles) {
    const key = `${Math.floor(t.tx / config.regionTiles)}_${Math.floor(t.tz / config.regionTiles)}`;
    let list = regions.get(key);
    if (!list) regions.set(key, (list = []));
    list.push(t);
  }
  await mkdir(outDir, { recursive: true });
  for (const f of await readdir(outDir)) if (/^region_.*\.bin$/.test(f)) await rm(path.join(outDir, f));
  const packs: { file: string; pack: BuiltPack }[] = [];
  const { sha256Hex } = await import('@kandern/world-format');
  for (const key of [...regions.keys()].sort()) {
    const pack = buildPack(regions.get(key)!);
    const hash = (await sha256Hex(pack.bytes)).slice(0, 10);
    const file = `region_${key}.${hash}.bin`;
    await writeFile(path.join(outDir, file), pack.bytes);
    packs.push({ file, pack });
  }

  const spawnPlace = places.find((p) => p.name === 'Kandern' && p.kind === 'town') ?? { x: 0, z: 0 };
  const index = await buildWorldIndex({
    packs,
    sourceDate: osmDate,
    tileSize: config.tileSize,
    quant: config.quant,
    origin: config.origin,
    spawn: { x: Math.round(spawnPlace.x * 10) / 10, z: Math.round(spawnPlace.z * 10) / 10 },
  });
  await writeFile(path.join(outDir, 'index.json'), JSON.stringify(index));
  await writeFile(path.join(outDir, 'attribution.json'), JSON.stringify(buildAttribution(osmDate, osmDate), null, 2));
  await writeFile(
    path.join(outDir, 'places.json'),
    JSON.stringify(places.map((p) => ({ ...p, x: Math.round(p.x), z: Math.round(p.z) }))),
  );
  const total = packs.reduce((s, p) => s + p.pack.bytes.length, 0);
  log(`${packs.length} Regionspakete, ${(total / 1048576).toFixed(1)} MB, Version ${index.buildVersion}`);
  return { tiles, places, outDir };
}
