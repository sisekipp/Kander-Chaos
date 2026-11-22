/// <reference lib="webworker" />
import { decodeTile, heightAt } from '@kandern/world-format';
import { gunzipSync } from 'fflate';
import type { BuildRequest, BuiltTile, WorkerResponse } from '../protocol.ts';
import { buildTerrain } from '../gen/terrainGen.ts';
import { buildBuildings } from '../gen/buildings/index.ts';
import { buildRoadGeometry } from '../roads/roadGeometry.ts';
import { buildWaterGeometry } from '../water/waterGeometry.ts';
import { buildVegetation } from '../gen/vegetationGen.ts';
import { buildOccupancy } from '../gen/occupancy.ts';
import { LandLookup } from '../gen/landLookup.ts';
import { transferablesOf } from '../gen/GeoBuilder.ts';
import { createShadeSampler } from '../terrain/bakedShade.ts';

declare const self: DedicatedWorkerGlobalScope;

/** Liest genau den Byte-Bereich einer Kachel (HTTP Range; der Service Worker bedient Range aus dem Cache). */
async function fetchRange(url: string, offset: number, length: number): Promise<Uint8Array> {
  const res = await fetch(url, { headers: { Range: `bytes=${offset}-${offset + length - 1}` } });
  if (!res.ok) throw new Error(`HTTP ${res.status} für ${url}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  // Server ohne Range-Unterstützung liefern 200 + ganze Datei -> selbst schneiden
  if (res.status === 200 && buf.length > length) return buf.subarray(offset, offset + length);
  return buf;
}

async function decompress(gz: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== 'undefined') {
    const stream = new Blob([gz as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  return gunzipSync(gz);
}

async function build(req: BuildRequest): Promise<BuiltTile> {
  const t0 = performance.now();
  const tile = decodeTile(await decompress(await fetchRange(req.packUrl, req.offset, req.length)));
  const t1 = performance.now();
  const land = new LandLookup(tile.land);
  const density = req.vegetationDensity * (req.ring === 0 ? 1 : req.ring === 1 ? 0.6 : 0.25);
  const trees = buildVegetation(tile, { density, land, blocked: req.ring === 0 ? buildOccupancy(tile) : undefined });
  // Verschattung nur in Ring 0/1 (in Ring 2 bei 9 Stützpunkten nicht sichtbar)
  const shade = req.ring <= 1 ? createShadeSampler(tile.buildings, trees.matrices) : undefined;
  const terrain = buildTerrain(tile, { lod: req.ring, skirtDepth: req.ring === 0 ? 3 : 8, land, shade });
  const skip = req.skipBuildings?.length ? new Set(req.skipBuildings) : undefined;
  const buildings = req.ring <= 1 ? buildBuildings(tile, { simple: req.ring === 1, skip }) : null;
  const roadGeo = req.ring === 0 ? buildRoadGeometry(tile, { simple: false }) : null;
  let heightfield: BuiltTile['heightfield'] = null;
  if (req.ring === 0) {
    const lod = tile.lods[0];
    const h = new Float32Array(lod.samples * lod.samples);
    for (let j = 0; j < lod.samples; j++)
      for (let i = 0; i < lod.samples; i++) h[j * lod.samples + i] = heightAt(tile, lod, i, j);
    heightfield = { samples: lod.samples, heights: h };
  }
  return {
    type: 'built',
    reqId: req.reqId,
    tileId: req.tileId,
    ring: req.ring,
    tx: tile.tx,
    tz: tile.tz,
    size: tile.size,
    terrain,
    buildings,
    roads: roadGeo?.roads ?? null,
    bridges: roadGeo?.bridges ?? null,
    water: req.ring <= 1 ? buildWaterGeometry(tile) : null,
    trees,
    props: req.ring === 0 ? (tile.props ?? []) : [],
    parking: req.ring === 0 ? (tile.parking ?? []) : [],
    heightfield,
    stats: {
      buildings: tile.buildings.length,
      roads: tile.roads.length,
      genMs: performance.now() - t1,
      fetchMs: t1 - t0,
    },
  };
}

self.onmessage = async (ev: MessageEvent<BuildRequest>) => {
  const req = ev.data;
  try {
    const res = await build(req);
    const transfer = [
      ...transferablesOf(res.terrain),
      ...transferablesOf(res.buildings),
      ...transferablesOf(res.roads),
      ...transferablesOf(res.bridges),
      ...transferablesOf(res.water),
      ...res.trees.matrices.map((m) => m.buffer as ArrayBuffer),
      ...res.trees.colors.map((m) => m.buffer as ArrayBuffer),
      ...(res.heightfield ? [res.heightfield.heights.buffer as ArrayBuffer] : []),
    ];
    self.postMessage(res satisfies WorkerResponse, transfer);
  } catch (e) {
    self.postMessage({
      type: 'error',
      reqId: req.reqId,
      tileId: req.tileId,
      message: (e as Error).message,
    } satisfies WorkerResponse);
  }
};
