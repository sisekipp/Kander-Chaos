import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.ts';
import type { OverpassResult } from './osm.ts';

const log = (...a: unknown[]) => console.log('[fetch]', ...a);

export async function overpass(query: string): Promise<string> {
  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      const res = await fetch(config.overpassUrl, {
        method: 'POST',
        headers: { 'User-Agent': config.userAgent, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: query }),
      });
      if (res.ok) return await res.text();
      log(`Overpass HTTP ${res.status}, Versuch ${attempt}/8`);
    } catch (e) {
      // Netzfehler (Verbindung abgebrochen) wie Überlastung behandeln
      log(`Overpass Netzfehler (${(e as Error).message}), Versuch ${attempt}/8`);
    }
    await new Promise((r) => setTimeout(r, Math.min(120000, 15000 * attempt)));
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
  /** Abrufgebiet statt der Ausdehnung der Grenzrelation (regionales Spielgebiet). */
  bbox?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
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
  const bb = f.bbox ?? rel.bounds ?? { minlat: 47.6586, minlon: 7.5696, maxlat: 47.7478, maxlon: 7.7183 };
  const chunks = chunkBoxes(bb, config.bufferM, f.chunkKm);
  await mkdir(f.chunkDir, { recursive: true });
  const fileOf = (i: number) => path.join(f.chunkDir, `chunk-${String(i).padStart(3, '0')}.json`);
  const missing = chunks.map((c, i) => ({ c, i })).filter(({ i }) => !existsSync(fileOf(i)));
  if (missing.length < chunks.length)
    log(`${f.label}: ${chunks.length - missing.length} vorhandene Teilstücke werden wiederverwendet`);
  // Parallelität über KC_OVERPASS_PARALLEL (Standard 1; bei Überlastung antwortet Overpass mit 502)
  let next = 0;
  const worker = async () => {
    while (next < missing.length) {
      const { c, i } = missing[next++];
      log(`${f.label}-Teilstück ${i + 1}/${chunks.length} …`);
      const bbox = c.map((v) => v.toFixed(6)).join(',');
      const text = await overpass(`[out:json][timeout:300][bbox:${bbox}];\n${f.query}`);
      JSON.parse(text); // nur vollständige Antworten speichern
      await writeFile(`${fileOf(i)}.tmp`, text);
      await rename(`${fileOf(i)}.tmp`, fileOf(i));
    }
  };
  const parallel = Math.max(1, Number(process.env.KC_OVERPASS_PARALLEL ?? 1));
  await Promise.all(Array.from({ length: parallel }, () => worker()));
  const parts: OverpassResult[] = [];
  for (let i = 0; i < chunks.length; i++) parts.push(JSON.parse(await readFile(fileOf(i), 'utf8')) as OverpassResult);
  const merged = mergeElements(parts);
  await writeFile(f.outFile, JSON.stringify(merged));
  log(`${f.label} zusammengeführt: ${merged.elements.length} Elemente aus ${chunks.length} Teilstücken`);
}
