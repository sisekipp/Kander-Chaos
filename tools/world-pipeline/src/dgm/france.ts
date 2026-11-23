/**
 * RGE ALTI (IGN, Lambert-93) über den WMS-R-Dienst der Géoplateforme: 2-km-Ausschnitte mit 4 m Abstand als
 * 32-Bit-Rohraster (BIL) laden und einlesen. Lizenz: Licence Ouverte 2.0, Namensnennung „IGN – RGE ALTI®“.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pieces, TileIndex } from './raster.ts';

const WMS = 'https://data.geopf.fr/wms-r';
const SIZE = 2000;
const PX = 500; // 4 m
const log = (...a: unknown[]) => console.log('[dgm-fr]', ...a);

export const franceUrl = (x: number, y: number): string =>
  `${WMS}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES&STYLES=` +
  `&CRS=EPSG:2154&BBOX=${x},${y},${x + SIZE},${y + SIZE}&WIDTH=${PX}&HEIGHT=${PX}&FORMAT=image/x-bil;bits=32`;

/** Ausschnitte über einem Lambert-93-Rechteck laden (fortsetzbar, `l93_<x>_<y>.bil`). */
export async function downloadFrance(
  rect: { minX: number; minY: number; maxX: number; maxY: number },
  dir: string,
  download: (url: string, file: string) => Promise<boolean>,
): Promise<void> {
  await mkdir(dir, { recursive: true });
  const list = pieces(rect.minX, rect.minY, rect.maxX, rect.maxY, SIZE);
  let k = 0;
  for (const [x, y] of list) {
    k++;
    const file = path.join(dir, `l93_${x}_${y}.bil`);
    if (existsSync(file)) continue;
    if (k % 10 === 1) log(`lade ${k}/${list.length} …`);
    await download(franceUrl(x, y), file);
  }
}

export async function loadFranceIndex(dir: string): Promise<TileIndex> {
  const idx = new TileIndex(SIZE);
  if (!existsSync(dir)) return idx;
  for (const f of (await readdir(dir)).filter((x) => x.endsWith('.bil')).sort()) {
    const m = /^l93_(\d+)_(\d+)\.bil$/.exec(f);
    if (!m) continue;
    const buf = await readFile(path.join(dir, f));
    if (buf.byteLength !== PX * PX * 4) continue;
    const data = new Float32Array(PX * PX);
    for (let i = 0; i < data.length; i++) data[i] = buf.readFloatLE(i * 4);
    idx.add({ x0: +m[1], yTop: +m[2] + SIZE, step: SIZE / PX, cols: PX, rows: PX, data, nodataBelow: -1000 });
  }
  log(`${idx.count} Ausschnitte eingelesen`);
  return idx;
}
