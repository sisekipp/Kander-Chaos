/** Fernsicht-Ausgaben des Builds (Spec world-streaming „Fernsicht“): Geländeraster und Liste hoher Gebäude. */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  buildFarTerrain,
  encodeFarTerrain,
  sampleHeight,
  tileId,
  type TileData,
  type WorldIndex,
} from '@kandern/world-format';
import { config } from '../config.ts';
import type { Landmark } from '../landmarks/select.ts';
import { buildSkyline } from './skyline.ts';

export async function writeFarOutputs(
  outDir: string,
  tiles: TileData[],
  index: WorldIndex,
  landmarks: Landmark[],
  log: (...a: unknown[]) => void,
): Promise<void> {
  // Fernsicht-Gelände: 64-m-Raster der ganzen Region aus der gröbsten Höhenstufe der Kacheln (gehört zum Kern)
  const ts = config.tileSize;
  const byTile = new Map(tiles.map((t) => [tileId(t.tx, t.tz), t]));
  const b = index.bounds;
  const far = buildFarTerrain(
    { minX: b.minTx * ts, minZ: b.minTz * ts, maxX: (b.maxTx + 1) * ts, maxZ: (b.maxTz + 1) * ts },
    64,
    (x, z) => {
      const t = byTile.get(tileId(Math.floor(x / ts), Math.floor(z / ts)));
      return t ? sampleHeight(t, t.lods[t.lods.length - 1], x - t.tx * ts, z - t.tz * ts) : null;
    },
  );
  await writeFile(path.join(outDir, 'farterrain.bin'), encodeFarTerrain(far));
  log(`Fernsicht-Gelände ${far.cols} × ${far.rows} Punkte`);
  // Fernsicht-Liste der hohen Gebäude (klein, gehört zum Kern)
  const skyline = buildSkyline(
    tiles,
    undefined,
    landmarks.map((l) => {
      const xs = l.footprint.filter((_, i) => i % 2 === 0),
        zs = l.footprint.filter((_, i) => i % 2 === 1);
      const size: [number, number] = [Math.max(...zs) - Math.min(...zs), Math.max(...xs) - Math.min(...xs)];
      return { id: l.id, buildingId: l.buildingId, x: l.x, z: l.z, height: l.height, size };
    }),
  );
  await writeFile(path.join(outDir, 'skyline.json'), JSON.stringify({ version: 1, buildings: skyline }));
  log(`${skyline.length} Gebäude ≥ 40 m in der Fernsicht-Liste`);
}
