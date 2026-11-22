import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.ts';
import type { OverpassResult } from './osm.ts';

const log = (...a: unknown[]) => console.log('[fetch]', ...a);

export async function overpass(query: string): Promise<string> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(config.overpassUrl, {
      method: 'POST',
      headers: { 'User-Agent': config.userAgent, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ data: query }),
    });
    if (res.ok) return res.text();
    log(`Overpass HTTP ${res.status}, Versuch ${attempt}/4`);
    await new Promise((r) => setTimeout(r, 15000 * attempt));
  }
  throw new Error('Overpass nicht erreichbar');
}

export interface ChunkedFetch {
  label: string;
  boundary: OverpassResult;
  /** Overpass-Abfrage ohne Kopf (wird je Teilstück mit [bbox:...] versehen). */
  query: string;
  chunkDir: string;
  outFile: string;
  /** Kantenlänge eines Teilstücks in km. */
  chunkKm: number;
}

/** Teilstücke (s, w, n, e) über die Grenzrelation + Randstreifen. Reine Funktion. */
export function chunkBoxes(
  bb: { minlat: number; minlon: number; maxlat: number; maxlon: number },
  bufferM: number,
  chunkKm: number,
): [number, number, number, number][] {
  const dLat = bufferM / 111320 + 0.002;
  const dLon = bufferM / (111320 * Math.cos((bb.minlat * Math.PI) / 180)) + 0.003;
  const s0 = bb.minlat - dLat,
    w0 = bb.minlon - dLon,
    n0 = bb.maxlat + dLat,
    e0 = bb.maxlon + dLon;
  const stepLat = 0.009 * chunkKm,
    stepLon = 0.0135 * chunkKm;
  const out: [number, number, number, number][] = [];
  for (let la = s0; la < n0; la += stepLat)
    for (let lo = w0; lo < e0; lo += stepLon)
      out.push([la, lo, Math.min(la + stepLat, n0), Math.min(lo + stepLon, e0)]);
  return out;
}

/** Elemente mehrerer Teilstücke zusammenführen: dedupliziert, stabil nach Typ und ID sortiert. */
export function mergeElements(parts: OverpassResult[]): OverpassResult {
  let timestamp = '';
  const merged = new Map<string, OverpassResult['elements'][number]>();
  for (const part of parts) {
    timestamp = part.osm3s?.timestamp_osm_base ?? timestamp;
    for (const el of part.elements) merged.set(`${el.type}/${el.id}`, el);
  }
  const order = { node: 0, way: 1, relation: 2 } as const;
  const elements = [...merged.values()].sort((a, b) => order[a.type] - order[b.type] || a.id - b.id);
  return { osm3s: { timestamp_osm_base: timestamp }, elements };
}

/**
 * Lädt OSM-Daten in Teilstücken, speichert jedes Stück einzeln (fortsetzbar) und führt sie zu
 * `outFile` zusammen. Vorhandene Teilstücke und eine vorhandene Ergebnisdatei werden wiederverwendet.
 */
export async function fetchOsmChunked(f: ChunkedFetch): Promise<void> {
  if (existsSync(f.outFile)) {
    log('vorhanden:', path.relative(config.paths.raw, f.outFile));
    return;
  }
  const rel = f.boundary.elements[0] as unknown as {
    bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
  };
  const bb = rel.bounds ?? { minlat: 47.6586, minlon: 7.5696, maxlat: 47.7478, maxlon: 7.7183 };
  const chunks = chunkBoxes(bb, config.bufferM, f.chunkKm);
  await mkdir(f.chunkDir, { recursive: true });
  const parts: OverpassResult[] = [];
  for (const [i, c] of chunks.entries()) {
    const file = path.join(f.chunkDir, `chunk-${String(i).padStart(3, '0')}.json`);
    if (!existsSync(file)) {
      log(`${f.label}-Teilstück ${i + 1}/${chunks.length} …`);
      const bbox = c.map((v) => v.toFixed(6)).join(',');
      const text = await overpass(`[out:json][timeout:300][bbox:${bbox}];\n${f.query}`);
      JSON.parse(text); // nur vollständige Antworten speichern
      await writeFile(`${file}.tmp`, text);
      await rename(`${file}.tmp`, file);
    } else if (i === 0) log(`${f.label}: vorhandene Teilstücke werden wiederverwendet`);
    parts.push(JSON.parse(await readFile(file, 'utf8')) as OverpassResult);
  }
  const merged = mergeElements(parts);
  await writeFile(f.outFile, JSON.stringify(merged));
  log(`${f.label} zusammengeführt: ${merged.elements.length} Elemente aus ${chunks.length} Teilstücken`);
}
