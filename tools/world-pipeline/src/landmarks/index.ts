/**
 * Wahrzeichen-Schritt des Builds: Auswahl aus den Gebäuden plus Konfiguration (`assets/landmarks/config.json`),
 * Ausgabe für das Spiel (`landmarks.json` neben den Kacheln) und für das Blender-Skript
 * (`assets/landmarks/footprints.json`, gleiche Daten).
 */
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ensureCCW, type Building } from '@kandern/world-format';
import { REPO_ROOT } from '../config.ts';
import { cleanRing, type RawBuilding } from '../buildings.ts';
import { selectLandmarks, type Landmark, type LandmarkExtra, type LandmarkOverride } from './select.ts';

interface LandmarkConfig {
  overrides: Record<string, LandmarkOverride>;
  extras: (Omit<LandmarkExtra, 'x' | 'z'> & { lat: number; lon: number })[];
}

export const LANDMARK_DIR = path.join(REPO_ROOT, 'assets/landmarks');

export async function buildLandmarks(
  raw: RawBuilding[],
  placed: Map<number, Building>,
  project: (p: { lat: number; lon: number }) => [number, number],
  inWorld: (x: number, z: number) => boolean,
): Promise<Landmark[]> {
  const file = path.join(LANDMARK_DIR, 'config.json');
  const cfg: LandmarkConfig = existsSync(file)
    ? (JSON.parse(await readFile(file, 'utf8')) as LandmarkConfig)
    : { overrides: {}, extras: [] };
  const rings = raw
    .filter((r) => placed.has(r.id))
    .map((r) => ({ id: r.id, tags: r.tags, outline: ensureCCW(cleanRing(r.outline)) }));
  const extras: LandmarkExtra[] = cfg.extras
    .map(({ lat, lon, ...e }) => {
      const [x, z] = project({ lat, lon });
      return { ...e, x, z };
    })
    .filter((e) => inWorld(e.x, e.z));
  return selectLandmarks(rings, placed, cfg.overrides, extras);
}

export async function writeLandmarks(landmarks: Landmark[], outDir: string): Promise<void> {
  const json = JSON.stringify({ version: 1, landmarks });
  await writeFile(path.join(outDir, 'landmarks.json'), json);
  await writeFile(
    path.join(LANDMARK_DIR, 'footprints.json'),
    JSON.stringify({ version: 1, landmarks }, null, 1) + '\n',
  );
}
