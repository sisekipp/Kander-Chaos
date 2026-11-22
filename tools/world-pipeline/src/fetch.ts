import { spawn } from 'node:child_process';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createInterface } from 'node:readline';
import { config } from './config.ts';
import { studyAreaFromBoundary } from './area.ts';
import type { OverpassResult } from './osm.ts';
import { DgmGrid } from './dgm.ts';
import { fetchOsmChunked, overpass } from './osmChunks.ts';

const log = (...a: unknown[]) => console.log('[fetch]', ...a);

export const rawPaths = {
  boundary: () => path.join(config.paths.raw, 'osm-boundary.json'),
  osm: () => process.env.KC_OSM_FILE ?? path.join(config.paths.raw, 'osm-data.json'),
  osmProps: () => path.join(config.paths.raw, 'osm-props.json'),
  dgmZip: (e: number, n: number) => path.join(config.paths.raw, 'dgm', `dgm1_32_${e}_${n}_2_bw.zip`),
  dgmMissing: (e: number, n: number) => path.join(config.paths.raw, 'dgm', `dgm1_32_${e}_${n}_2_bw.missing`),
  dgmGrid: () => path.join(config.paths.work, 'dgm-2m.bin'),
};

async function cached(file: string, produce: () => Promise<string | Buffer>): Promise<void> {
  if (existsSync(file)) {
    log('vorhanden:', path.relative(config.paths.raw, file));
    return;
  }
  await mkdir(path.dirname(file), { recursive: true });
  const data = await produce();
  await writeFile(`${file}.tmp`, data);
  await rename(`${file}.tmp`, file);
}

async function download(url: string, file: string): Promise<boolean> {
  const res = await fetch(url, { headers: { 'User-Agent': config.userAgent } });
  if (res.status === 404) return false;
  if (!res.ok || !res.body) throw new Error(`${url}: HTTP ${res.status}`);
  await mkdir(path.dirname(file), { recursive: true });
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(`${file}.tmp`));
  await rename(`${file}.tmp`, file);
  return true;
}

/** Liest alle .xyz-Dateien eines ZIPs zeilenweise (Streaming über `unzip -p`). */
async function streamXyz(zip: string, onPoint: (e: number, n: number, h: number) => void): Promise<void> {
  const child = spawn('unzip', ['-p', zip, '*.xyz']);
  const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
  for await (const line of rl) {
    const a = line.indexOf(' ');
    const b = line.indexOf(' ', a + 1);
    if (a < 0 || b < 0) continue;
    onPoint(+line.slice(0, a), +line.slice(a + 1, b), +line.slice(b + 1));
  }
  await new Promise<void>((resolve, reject) => {
    child.on('close', (code) => (code === 0 || code === null ? resolve() : reject(new Error(`unzip ${code}`))));
  });
}

export async function runFetch(): Promise<void> {
  // 1. Gemeindegrenze
  await cached(rawPaths.boundary(), () =>
    overpass(`[out:json][timeout:120];relation(${config.boundaryRelation});out body geom;`),
  );
  const area = studyAreaFromBoundary(JSON.parse(await readFile(rawPaths.boundary(), 'utf8')) as OverpassResult);
  const { origin } = config;
  const minE = origin.easting + area.minX,
    maxE = origin.easting + area.maxX;
  const minN = origin.northing + area.minZ,
    maxN = origin.northing + area.maxZ;
  log(`Gebiet UTM E ${minE.toFixed(0)}–${maxE.toFixed(0)}, N ${minN.toFixed(0)}–${maxN.toFixed(0)}`);

  // 3. DGM1-Kacheln (2 km, Easting ungerade, Northing gerade, in km)
  const e0 = Math.floor(minE / 1000),
    e1 = Math.floor(maxE / 1000);
  const n0 = Math.floor(minN / 1000),
    n1 = Math.floor(maxN / 1000);
  const zips: { e: number; n: number }[] = [];
  for (let n = n0 - (n0 % 2); n <= n1; n += 2) {
    for (let e = e0 - ((e0 + 1) % 2); e <= e1; e += 2) zips.push({ e, n });
  }
  log(`${zips.length} DGM-Kacheln benötigt`);
  for (const { e, n } of zips) {
    if (existsSync(rawPaths.dgmZip(e, n)) || existsSync(rawPaths.dgmMissing(e, n))) continue;
    log(`lade DGM ${e}/${n} …`);
    const ok = await download(config.dgmUrl(e, n), rawPaths.dgmZip(e, n));
    if (!ok) {
      log(`DGM ${e}/${n} existiert nicht (außerhalb BW?) – wird als Lücke behandelt`);
      await writeFile(rawPaths.dgmMissing(e, n), '');
    }
  }

  // 4. Auf 2-m-Raster reduzieren (Mittel der vier 1-m-Punkte um jeden geraden Gitterpunkt)
  if (existsSync(rawPaths.dgmGrid())) log('2-m-Raster vorhanden');
  else await buildDgmGrid(zips, minE, minN, maxE, maxN);

  // 5. OSM-Daten in Teilstücken (große Abfragen scheitern am Overpass-Zeitlimit)
  const boundary = JSON.parse(await readFile(rawPaths.boundary(), 'utf8')) as OverpassResult;
  await fetchOsmChunked({
    label: 'OSM',
    boundary,
    query: OSM_QUERY_BODY,
    chunkDir: path.join(config.paths.raw, 'osm-chunks'),
    outFile: rawPaths.osm(),
    chunkKm: 2,
  });
  // 6. Straßenmöbel, Barrieren, Parkplätze
  await fetchOsmChunked({
    label: 'Props',
    boundary,
    query: PROPS_QUERY_BODY,
    chunkDir: path.join(config.paths.raw, 'osm-props-chunks'),
    outFile: rawPaths.osmProps(),
    chunkKm: 4,
  });
}

async function buildDgmGrid(
  zips: { e: number; n: number }[],
  minE: number,
  minN: number,
  maxE: number,
  maxN: number,
): Promise<void> {
  const grid = DgmGrid.create(
    Math.floor(minE / 2) * 2 - 4,
    Math.floor(minN / 2) * 2 - 4,
    Math.ceil(maxE / 2) * 2 + 4,
    Math.ceil(maxN / 2) * 2 + 4,
  );
  log(`2-m-Raster ${grid.cols} x ${grid.rows}`);
  for (const { e, n } of zips) {
    const zip = rawPaths.dgmZip(e, n);
    if (!existsSync(zip)) continue;
    log(`verarbeite ${path.basename(zip)} (${((await stat(zip)).size / 1e6).toFixed(1)} MB)`);
    await streamXyz(zip, (pe, pn, h) => grid.accumulate(pe, pn, h));
  }
  grid.finalize();
  await mkdir(config.paths.work, { recursive: true });
  await writeFile(rawPaths.dgmGrid(), grid.serialize());
  log(`2-m-Raster gespeichert, Lücken: ${grid.holes}`);
}

const OSM_QUERY_BODY = `(
  way["building"]; relation["building"];
  way["highway"]; way["railway"~"^(rail|light_rail|narrow_gauge|preserved)$"];
  way["landuse"]; relation["landuse"];
  way["natural"~"^(wood|water|scrub|grassland|heath)$"]; relation["natural"~"^(wood|water)$"];
  way["leisure"~"^(park|pitch|sports_centre|playground|garden)$"];
  way["waterway"~"^(river|stream|ditch|canal|drain)$"];
  node["place"~"^(town|village|hamlet|suburb|neighbourhood|isolated_dwelling)$"];
);
out body geom;`;

/** Straßenmöbel, Barrieren, Parkplätze, Übergänge und Gebäudeteile (dünn gesät -> größere Teilstücke). */
const PROPS_QUERY_BODY = `(
  node["highway"~"^(street_lamp|traffic_signals|bus_stop|crossing)$"];
  node["amenity"~"^(waste_basket|bench|bicycle_parking|parking|post_box)$"];
  node["emergency"="fire_hydrant"]; node["barrier"="bollard"]; node["advertising"="column"];
  node["traffic_sign"];
  way["barrier"~"^(fence|hedge|wall)$"];
  way["amenity"="parking"]; relation["amenity"="parking"];
  node["leisure"="playground"]; way["leisure"="playground"];
  way["building:part"]; way["man_made"="tower"]["tower:type"="bell_tower"];
);
out body geom;`;
