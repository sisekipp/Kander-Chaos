import { readFile, readdir, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import {
  RoadKind,
  readTileFromPack,
  sampleHeight,
  sha256Hex,
  type TileData,
  type WorldIndex,
} from '@kandern/world-format';
import { existsSync } from 'node:fs';
import { DgmGrid } from './dgm.ts';
import { rawPaths } from './fetch.ts';
import { checkProps } from './props/check.ts';
import { config } from './config.ts';
import { RoadGraph } from './roads.ts';
import type { Place } from './build.ts';

const ok = (m: string) => console.log(`  ✔ ${m}`);
const fail = (m: string) => console.log(`  ✘ ${m}`);

export async function loadWorld(dir: string): Promise<{ index: WorldIndex; tiles: TileData[]; places: Place[] }> {
  const index = JSON.parse(await readFile(path.join(dir, 'index.json'), 'utf8')) as WorldIndex;
  const packs = await Promise.all(index.packs.map((p) => readFile(path.join(dir, p.file))));
  const tiles = Object.values(index.tiles).map((loc) => readTileFromPack(packs[loc[0]], loc));
  const places = JSON.parse(await readFile(path.join(dir, 'places.json'), 'utf8')) as Place[];
  return { index, tiles, places };
}

async function dirHashes(dir: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const f of (await readdir(dir)).sort()) out.set(f, await sha256Hex(await readFile(path.join(dir, f))));
  return out;
}

export async function runCheck({ determinism }: { determinism: boolean }): Promise<boolean> {
  const dir = config.paths.out;
  let good = true;
  console.log('[check] Welt in', path.relative(process.cwd(), dir) || dir);
  const { index, tiles, places } = await loadWorld(dir);

  // 1. Integrität der Pakete
  for (const p of index.packs) {
    const bytes = await readFile(path.join(dir, p.file));
    if (bytes.length !== p.bytes || (await sha256Hex(bytes)) !== p.sha256) {
      fail(`Hash stimmt nicht: ${p.file}`);
      good = false;
    }
  }
  ok(`${index.packs.length} Pakete, Hashes geprüft`);

  // 2. Budget
  let total = 0;
  for (const p of index.packs) total += (await stat(path.join(dir, p.file))).size;
  const mb = (total / 1048576).toFixed(1);
  if (total > config.budgetBytes) {
    fail(`Kacheldaten ${mb} MB > Budget ${config.budgetBytes / 1048576} MB`);
    good = false;
  } else ok(`Kacheldaten ${mb} MB ≤ ${config.budgetBytes / 1048576} MB`);

  // 3. Abdeckung der Ortsteile: Kacheln im Umkreis von 300 m enthalten Gebäude
  const byId = new Map(tiles.map((t) => [`${t.tx},${t.tz}`, t]));
  for (const name of config.requiredPlaces) {
    const p = places.find((pl) => pl.name === name);
    if (!p) {
      fail(`Ort "${name}" nicht in den OSM-Daten`);
      good = false;
      continue;
    }
    let n = 0;
    const s = config.tileSize;
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        n += byId.get(`${Math.floor(p.x / s) + dx},${Math.floor(p.z / s) + dz}`)?.buildings.length ?? 0;
      }
    if (n === 0) {
      fail(`${name}: keine Gebäude`);
      good = false;
    } else ok(`${name}: ${n} Gebäude im Umkreis`);
  }

  // 4. Straßen-Konnektivität Kernstadt -> Tannenkirch (befahrbare Straßen)
  const g = new RoadGraph();
  for (const t of tiles) g.addTileRoads(t.tx, t.tz, t.size, t.roads, (r) => r.kind <= RoadKind.Track);
  const from = places.find((p) => p.name === 'Kandern');
  const to = places.find((p) => p.name === 'Tannenkirch');
  if (from && to) {
    const a = g.nearest(from.x, from.z),
      b = g.nearest(to.x, to.z);
    if (a !== null && b !== null && g.connected(a, b)) ok('Straßennetz verbindet Kandern und Tannenkirch');
    else {
      fail('Keine Straßenverbindung Kandern -> Tannenkirch');
      good = false;
    }
  }

  // 5. Kleinobjekte und Parkpositionen
  const pc = checkProps(index, tiles);
  for (const m of pc.messages) console.log(`  ${m.startsWith('✔') || m.startsWith('✘') ? m : `✘ ${m}`}`);
  if (!pc.ok) good = false;

  // 5b. Höhengenauigkeit am Startpunkt (Blumenplatz) gegen das DGM-Raster
  if (existsSync(rawPaths.dgmGrid())) {
    const grid = DgmGrid.deserialize(await readFile(rawPaths.dgmGrid()));
    const s = config.tileSize;
    let worst = 0;
    for (const [dx, dz] of [
      [0, 0],
      [17, -9],
      [-33, 41],
    ]) {
      const x = index.spawn.x + dx,
        z = index.spawn.z + dz;
      const t = byId.get(`${Math.floor(x / s)},${Math.floor(z / s)}`);
      if (!t) continue;
      const h = sampleHeight(t, t.lods[0], x - t.tx * s, z - t.tz * s);
      const ref = grid.sample(config.origin.easting + x, config.origin.northing + z);
      worst = Math.max(worst, Math.abs(h - ref));
    }
    if (worst <= 2) ok(`Höhe am Blumenplatz weicht max. ${worst.toFixed(2)} m vom DGM ab`);
    else {
      fail(`Höhenabweichung ${worst.toFixed(2)} m > 2 m`);
      good = false;
    }
  }

  // 6. Determinismus: zweimal bauen, Dateien vergleichen
  if (determinism) {
    const { runBuild } = await import('./build.ts');
    const tmpA = await mkdtemp(path.join(os.tmpdir(), 'kc-a-'));
    const tmpB = await mkdtemp(path.join(os.tmpdir(), 'kc-b-'));
    try {
      await runBuild(tmpA);
      await runBuild(tmpB);
      const [ha, hb] = [await dirHashes(tmpA), await dirHashes(tmpB)];
      const same = ha.size === hb.size && [...ha].every(([f, h]) => hb.get(f) === h);
      if (same) ok(`Determinismus: zwei Läufe bytegleich (${ha.size} Dateien)`);
      else {
        fail('Determinismus: Läufe unterscheiden sich');
        good = false;
      }
    } finally {
      await rm(tmpA, { recursive: true, force: true });
      await rm(tmpB, { recursive: true, force: true });
    }
  }

  console.log(good ? '[check] alles in Ordnung' : '[check] FEHLER');
  return good;
}
