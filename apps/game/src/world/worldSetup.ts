import type { WorldIndex } from '@kandern/world-format';
import type { Game } from '../engine/Game.ts';
import { BASE_URL } from '../engine/assets.ts';
import { getModels } from '../assets/ModelRegistry.ts';
import { TileManager } from './tiles/TileManager.ts';
import { GeometryLayer } from './tiles/GeometryLayer.ts';
import { CollisionLayer } from './tiles/CollisionLayer.ts';
import { LandmarkLayer } from './landmarks/LandmarkLayer.ts';
import type { LandmarkInfo } from './landmarks/placement.ts';
import type { HelipadInfo } from '../vehicles/helicopter/HeliSystem.ts';
import { RoadLayer } from './roads/RoadLayer.ts';
import { TreeLayer } from './vegetation/TreeLayer.ts';
import { createTreeBases } from './vegetation/treeMeshes.ts';
import type { WorldMaterials } from './worldMaterials.ts';
import type { WorkerPool } from './WorkerPool.ts';
import type { PackSource } from '../offline/packSource.ts';

/** Aufbau der Welt-Daten und der statischen Kachel-Layer (aus World.ts ausgelagert). */

export interface Place {
  name: string;
  kind: string;
  x: number;
  z: number;
}

export const WORLD_URL = new URL(`${BASE_URL}world/`, location.href).href;

export async function loadWorldIndex(): Promise<{
  index: WorldIndex;
  places: Place[];
  landmarks: LandmarkInfo[];
  helipads: HelipadInfo[];
}> {
  const [index, places, landmarks, helipads] = await Promise.all([
    fetch(`${WORLD_URL}index.json`).then((r) => {
      if (!r.ok) throw new Error(`Weltindex fehlt (HTTP ${r.status}) – Pipeline "build" ausführen`);
      return r.json() as Promise<WorldIndex>;
    }),
    fetch(`${WORLD_URL}places.json`).then((r) => (r.ok ? (r.json() as Promise<Place[]>) : [])),
    // Wahrzeichen sind optional: fehlen sie (alter Cache, offline), bleibt es bei den generierten Gebäuden
    fetch(`${WORLD_URL}landmarks.json`)
      .then((r) => (r.ok ? r.json().then((j) => j.landmarks as LandmarkInfo[]) : []))
      .catch(() => [] as LandmarkInfo[]),
    fetch(`${WORLD_URL}helipads.json`)
      .then((r) => (r.ok ? r.json().then((j) => j.helipads as HelipadInfo[]) : []))
      .catch(() => [] as HelipadInfo[]),
  ]);
  return { index, places, landmarks, helipads };
}

/** Kachelverwaltung mit Wahrzeichen und den statischen Layern (Geometrie, Wahrzeichen, Kollision, Straßen, Bäume). */
export function createTiles(
  game: Game,
  index: WorldIndex,
  pool: WorkerPool,
  materials: WorldMaterials,
  physics: boolean,
  landmarkList: LandmarkInfo[],
  packs: PackSource | null = null,
): { tiles: TileManager; landmarks: LandmarkLayer } {
  const scene = game.scene;
  const q = game.quality;
  const usable = LandmarkLayer.usable(landmarkList, getModels());
  let landmarksRef: LandmarkLayer | null = null;
  const tiles = new TileManager({
    skipBuildings: (id) => landmarksRef?.skipFor(id) ?? [],
    scene,
    index,
    worldUrl: WORLD_URL,
    pool,
    viewDistance: q.viewDistance,
    vegetationDensity: q.vegetationDensity,
    physics,
    packs: packs ?? undefined,
    onTileBuilt: (t) => {
      if (t.ring === 0) {
        const rec = game.perf.recorder.extra;
        rec.maxTileGenMs = Math.max(Number(rec.maxTileGenMs ?? 0), Math.round(t.stats.genMs));
        rec.maxTileBuildings = Math.max(Number(rec.maxTileBuildings ?? 0), t.stats.buildings);
      }
    },
  });
  tiles.addLayer(new GeometryLayer(scene, materials));
  const landmarks = new LandmarkLayer(scene, getModels()!, usable, index.tileSize, physics);
  landmarksRef = landmarks;
  if (usable.length) {
    tiles.addLayer(landmarks);
    landmarks.watchRemote((id) => tiles.refresh(id));
  }
  if (physics) tiles.addLayer(new CollisionLayer(scene));
  tiles.addLayer(new RoadLayer(scene, materials.roads, physics, materials.water));
  tiles.addLayer(new TreeLayer(scene, createTreeBases(scene, materials.trees)));
  return { tiles, landmarks };
}
