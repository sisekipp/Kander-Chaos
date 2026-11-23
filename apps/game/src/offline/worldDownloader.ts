import { sha256Hex, type WorldIndex } from '@kandern/world-format';
import { BASE_URL } from '../engine/assets.ts';

/** Gleicher Name wie im Service Worker. */
export const WORLD_CACHE = 'kc-world';
const META_FILES = [
  'places.json',
  'attribution.json',
  'landmarks.json',
  'helipads.json',
  'skyline.json',
  'farterrain.bin',
  'silhouettes.json',
] as const;
const worldPath = (f: string) => `${BASE_URL}world/${f}`;
const pendingPath = (f: string) => `${BASE_URL}world/pending/${f}`;

export interface DownloadProgress {
  /** 0..1 über alle fehlenden Bytes. */
  fraction: number;
  loadedBytes: number;
  totalBytes: number;
  file: string;
}

export type WorldStatus =
  | { state: 'ready'; index: WorldIndex; updatePending: boolean }
  | { state: 'needs-network'; message: string };

async function readJson<T>(cache: Cache, path: string): Promise<T | null> {
  const r = await cache.match(path);
  return r ? ((await r.json()) as T) : null;
}

async function fetchFresh(file: string): Promise<Response> {
  const r = await fetch(`${worldPath(file)}?check=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${file}: HTTP ${r.status}`);
  return r;
}

/** Fehlende Pakete eines Index laden (einzeln, Hash-geprüft, fortsetzbar). */
async function downloadPacks(
  cache: Cache,
  index: WorldIndex,
  onProgress: (p: DownloadProgress) => void,
): Promise<void> {
  const missing = [];
  // Nur der Kern wird vorgeladen; Nachladeregionen kommen bei Bedarf aus Cloudflare (Region-Cache)
  for (const p of index.packs) if (!p.remote && !(await cache.match(worldPath(p.file)))) missing.push(p);
  const totalBytes = missing.reduce((s, p) => s + p.bytes, 0);
  let loadedBytes = 0;
  onProgress({ fraction: totalBytes ? 0 : 1, loadedBytes, totalBytes, file: '' });
  for (const p of missing) {
    const res = await fetch(worldPath(p.file), { cache: 'no-store' });
    if (!res.ok || !res.body) throw new Error(`${p.file}: HTTP ${res.status}`);
    // Fortschritt innerhalb einer Datei mitzählen
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      got += value.length;
      onProgress({
        fraction: (loadedBytes + got) / totalBytes,
        loadedBytes: loadedBytes + got,
        totalBytes,
        file: p.file,
      });
    }
    const bytes = new Uint8Array(got);
    let off = 0;
    for (const c of chunks) {
      bytes.set(c, off);
      off += c.length;
    }
    if (bytes.length !== p.bytes || (await sha256Hex(bytes)) !== p.sha256)
      throw new Error(`${p.file}: Prüfsumme falsch – bitte erneut versuchen`);
    await cache.put(
      worldPath(p.file),
      new Response(bytes, {
        headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(bytes.length) },
      }),
    );
    loadedBytes += p.bytes;
  }
}

/** Aktiviert einen vollständig geladenen Index: Metadaten tauschen, verwaiste Pakete löschen. */
async function activate(cache: Cache, index: WorldIndex, meta: Record<string, Response | null>): Promise<void> {
  for (const f of META_FILES) {
    const r = meta[f];
    if (r) await cache.put(worldPath(f), r);
  }
  await cache.put(
    worldPath('index.json'),
    new Response(JSON.stringify(index), { headers: { 'Content-Type': 'application/json' } }),
  );
  const keep = new Set(index.packs.map((p) => worldPath(p.file)));
  for (const req of await cache.keys()) {
    const path = new URL(req.url).pathname;
    if (path.endsWith('.bin') && !keep.has(path)) await cache.delete(req);
  }
  for (const f of ['index.json', ...META_FILES]) await cache.delete(pendingPath(f));
}

/**
 * Sorgt dafür, dass die Welt offline verfügbar ist.
 * - Erster Start: lädt alle Pakete (mit Fortschritt) und aktiviert den Index.
 * - Später online: prüft auf neue Daten, lädt nur geänderte Pakete im Hintergrund und merkt sie
 *   als "Update bereit" vor (aktiviert beim nächsten Start oder per `applyPendingWorld`).
 * - Offline: nutzt den aktiven Index aus dem Cache.
 */
export async function ensureWorld(onProgress: (p: DownloadProgress) => void): Promise<WorldStatus> {
  const cache = await caches.open(WORLD_CACHE);
  // Vorgemerktes Update vom letzten Mal jetzt aktivieren ("beim nächsten Start")
  const pending = await readJson<WorldIndex>(cache, pendingPath('index.json'));
  if (pending && (await allPacksPresent(cache, pending))) {
    const meta: Record<string, Response | null> = {};
    for (const f of META_FILES) meta[f] = (await cache.match(pendingPath(f))) ?? null;
    await activate(cache, pending, meta);
  }
  const active = await readJson<WorldIndex>(cache, worldPath('index.json'));
  let remote: WorldIndex | null = null;
  const remoteMeta: Record<string, Response | null> = {};
  try {
    remote = (await (await fetchFresh('index.json')).json()) as WorldIndex;
    for (const f of META_FILES) remoteMeta[f] = await fetchFresh(f).catch(() => null);
  } catch {
    remote = null; // offline
  }

  if (!active) {
    if (!remote)
      return { state: 'needs-network', message: 'Für den ersten Start wird einmal eine Internetverbindung gebraucht.' };
    await downloadPacks(cache, remote, onProgress); // wirft bei Abbruch; Fortsetzen beim nächsten Start
    await activate(cache, remote, remoteMeta);
    return { state: 'ready', index: remote, updatePending: false };
  }
  if (!(await allPacksPresent(cache, active))) {
    // Daten unvollständig (z. B. von Safari teilweise gelöscht): reparieren, wenn online
    if (remote && remote.buildVersion === active.buildVersion) await downloadPacks(cache, active, onProgress);
    else if (remote) {
      await downloadPacks(cache, remote, onProgress);
      await activate(cache, remote, remoteMeta);
      return { state: 'ready', index: remote, updatePending: false };
    } else
      return { state: 'needs-network', message: 'Weltdaten sind unvollständig. Bitte einmal mit Internet starten.' };
  }
  if (remote && remote.buildVersion !== active.buildVersion) {
    // Update im Hintergrund laden, laufendes Spiel nicht stören
    void (async () => {
      try {
        await downloadPacks(cache, remote, () => {});
        await cache.put(
          pendingPath('index.json'),
          new Response(JSON.stringify(remote), { headers: { 'Content-Type': 'application/json' } }),
        );
        for (const f of META_FILES) if (remoteMeta[f]) await cache.put(pendingPath(f), remoteMeta[f]!.clone());
        window.dispatchEvent(new CustomEvent('kc-world-update-ready'));
      } catch (e) {
        console.warn('[welt] Update-Download abgebrochen, nächster Versuch beim nächsten Start', e);
      }
    })();
  }
  return { state: 'ready', index: active, updatePending: !!pending };
}

async function allPacksPresent(cache: Cache, index: WorldIndex): Promise<boolean> {
  for (const p of index.packs) if (!p.remote && !(await cache.match(worldPath(p.file)))) return false;
  return true;
}

/** Vorgemerktes Welt-Update sofort aktivieren (Nutzer hat "Update" bestätigt). */
export async function applyPendingWorld(): Promise<boolean> {
  const cache = await caches.open(WORLD_CACHE);
  const pending = await readJson<WorldIndex>(cache, pendingPath('index.json'));
  if (!pending || !(await allPacksPresent(cache, pending))) return false;
  const meta: Record<string, Response | null> = {};
  for (const f of META_FILES) meta[f] = (await cache.match(pendingPath(f))) ?? null;
  await activate(cache, pending, meta);
  return true;
}

/** Bittet den Browser, die Daten nicht zu löschen, und liefert die aktuelle Belegung. */
export async function requestPersistence(): Promise<{
  persisted: boolean;
  usageMb: number | null;
  quotaMb: number | null;
}> {
  let persisted = false;
  try {
    persisted = (await navigator.storage?.persisted?.()) || (await navigator.storage?.persist?.()) || false;
  } catch {
    /* nicht unterstützt */
  }
  let usageMb: number | null = null,
    quotaMb: number | null = null;
  try {
    const e = await navigator.storage?.estimate?.();
    if (e) {
      usageMb = Math.round((e.usage ?? 0) / 1048576);
      quotaMb = Math.round((e.quota ?? 0) / 1048576);
    }
  } catch {
    /* ignorieren */
  }
  return { persisted, usageMb, quotaMb };
}
