/**
 * swissALTI3D (swisstopo, 2-m-Raster, LV95): Kacheln über die STAC-API finden, fortsetzbar laden und als
 * abtastbaren Index einlesen. Lizenz: OGD-Nutzungsbedingungen swisstopo, Quellenangabe Pflicht.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fromArrayBuffer } from 'geotiff';
import type { LatLonBox } from '../region/area.ts';
import { newestPerTile, parseSwissItem, TileIndex } from './raster.ts';

const STAC = 'https://data.geo.admin.ch/api/stac/v0.9/collections/ch.swisstopo.swissalti3d/items';
const log = (...a: unknown[]) => console.log('[dgm-ch]', ...a);

interface StacItem {
  id: string;
  assets: Record<string, { href: string; 'eo:gsd'?: number }>;
}

/** Alle Kacheln im Gebiet (neuester Jahrgang je Kachel) mit der URL des 2-m-GeoTIFF. */
export async function listSwissTiles(box: LatLonBox, userAgent: string): Promise<{ id: string; href: string }[]> {
  const items: StacItem[] = [];
  let url: string | null = `${STAC}?bbox=${box.west},${box.south},${box.east},${box.north}&limit=100`;
  while (url) {
    const res = await fetch(url, { headers: { 'User-Agent': userAgent } });
    if (!res.ok) throw new Error(`STAC HTTP ${res.status}`);
    const page = (await res.json()) as { features: StacItem[]; links: { rel: string; href: string }[] };
    items.push(...page.features);
    url = page.links.find((l) => l.rel === 'next')?.href ?? null;
  }
  return newestPerTile(items).flatMap((it) => {
    const a = Object.values(it.assets).find((x) => x.href.endsWith('.tif') && x['eo:gsd'] === 2);
    return a ? [{ id: it.id, href: a.href }] : [];
  });
}

/** Lädt fehlende Kacheln nach `dir` (eine Datei je Kachel, `<id>.tif`). */
export async function downloadSwissTiles(
  tiles: { id: string; href: string }[],
  dir: string,
  download: (url: string, file: string) => Promise<boolean>,
): Promise<void> {
  await mkdir(dir, { recursive: true });
  let k = 0;
  for (const t of tiles) {
    k++;
    const file = path.join(dir, `${t.id}.tif`);
    if (existsSync(file)) continue;
    if (k % 20 === 1) log(`lade ${k}/${tiles.length} …`);
    await download(t.href, file);
  }
}

/** Liest alle Kacheln in `dir` als Index in LV95-Koordinaten (1-km-Kacheln, Kehrwert NoData −9999). */
export async function loadSwissIndex(dir: string): Promise<TileIndex> {
  const idx = new TileIndex(1000);
  if (!existsSync(dir)) return idx;
  for (const f of (await readdir(dir)).filter((x) => x.endsWith('.tif')).sort()) {
    const p = parseSwissItem(f.replace(/\.tif$/, ''));
    if (!p) continue;
    const buf = await readFile(path.join(dir, f));
    const tiff = await fromArrayBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    const img = await tiff.getImage();
    const [raster] = (await img.readRasters()) as unknown as Float32Array[];
    const step = 1000 / img.getWidth();
    idx.add({
      x0: p.e,
      yTop: p.n + 1000,
      step,
      cols: img.getWidth(),
      rows: img.getHeight(),
      data: Float32Array.from(raster),
      nodataBelow: -1000,
    });
  }
  log(`${idx.count} Kacheln eingelesen`);
  return idx;
}
