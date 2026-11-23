/**
 * Landeplätze (Spec helicopter): feste Liste aus `assets/helipads.json`, in Weltkoordinaten umgerechnet und
 * auf das Spielgebiet beschränkt. Ausgabe `world/helipads.json` für das Spiel.
 */
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { REPO_ROOT } from './config.ts';

export interface HelipadSource {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Ausrichtung des bereitstehenden Hubschraubers (Grad, 0 = Norden, im Uhrzeigersinn). */
  heading: number;
}

export interface Helipad {
  id: string;
  name: string;
  x: number;
  z: number;
  /** Gierwinkel im Spiel (rad, 0 = +z = Norden). */
  heading: number;
}

/** Reine Auswahl: umrechnen, außerhalb liegende verwerfen, nach ID sortieren. */
export function selectHelipads(
  list: HelipadSource[],
  project: (p: { lat: number; lon: number }) => [number, number],
  inWorld: (x: number, z: number) => boolean,
): Helipad[] {
  return list
    .map((h) => {
      const [x, z] = project(h);
      return {
        id: h.id,
        name: h.name,
        x: Math.round(x * 10) / 10,
        z: Math.round(z * 10) / 10,
        heading: (h.heading * Math.PI) / 180,
      };
    })
    .filter((h) => inWorld(h.x, h.z))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export async function writeHelipads(
  outDir: string,
  project: (p: { lat: number; lon: number }) => [number, number],
  inWorld: (x: number, z: number) => boolean,
): Promise<number> {
  const file = path.join(REPO_ROOT, 'assets/helipads.json');
  const list = existsSync(file) ? (JSON.parse(await readFile(file, 'utf8')).helipads as HelipadSource[]) : [];
  const pads = selectHelipads(list, project, inWorld);
  await writeFile(path.join(outDir, 'helipads.json'), JSON.stringify({ version: 1, helipads: pads }));
  return pads.length;
}
