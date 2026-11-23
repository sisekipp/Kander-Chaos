import { sha256Hex, type WorldIndex } from '@kandern/world-format';
import { PackSource } from './packSource.ts';
import { RegionCache, regionCacheName, type CacheLike, type MetaStore, type RegionEntry } from './regionCache.ts';

/** Verdrahtung im Browser: Region-Cache (Cache-API + localStorage) und Paketquelle für einen Weltindex. */

const META_KEY = 'kc-regions-meta';
let current: { version: string; cache: RegionCache } | null = null;

const localMeta = (version: string): MetaStore => ({
  load: () => {
    try {
      const m = JSON.parse(localStorage.getItem(META_KEY) ?? 'null') as { version: string; entries: RegionEntry[] };
      return m?.version === version ? m.entries : [];
    } catch {
      return [];
    }
  },
  save: (entries) => localStorage.setItem(META_KEY, JSON.stringify({ version, entries })),
});

/** Region-Cache des aktuellen Datenstands; alte Stände werden gelöscht. Null ohne Cache-API (z. B. http). */
export async function regionCache(version: string): Promise<RegionCache | null> {
  if (current?.version === version) return current.cache;
  if (typeof caches === 'undefined') return null;
  for (const key of await caches.keys())
    if (key.startsWith('kc-regions-') && key !== regionCacheName(version)) await caches.delete(key);
  const c = await caches.open(regionCacheName(version));
  const like: CacheLike = { match: (k) => c.match(k), put: (k, r) => c.put(k, r), delete: (k) => c.delete(k) };
  current = { version, cache: new RegionCache(like, localMeta(version)) };
  return current.cache;
}

/** Belegter Speicher der Nachladeregionen (Einstellungen) – auch vor dem Laden der Welt. */
export function regionUsage(): { bytes: number; count: number } {
  if (current) return { bytes: current.cache.usedBytes, count: current.cache.count };
  try {
    const m = JSON.parse(localStorage.getItem(META_KEY) ?? 'null') as { entries: RegionEntry[] } | null;
    const e = m?.entries ?? [];
    return { bytes: e.reduce((s, x) => s + x.bytes, 0), count: e.length };
  } catch {
    return { bytes: 0, count: 0 };
  }
}

/** „Gespeicherte Regionen löschen“ – Spielstand und Kernwelt bleiben. */
export async function clearRegions(): Promise<void> {
  if (current) await current.cache.clear();
  if (typeof caches !== 'undefined')
    for (const key of await caches.keys()) if (key.startsWith('kc-regions-')) await caches.delete(key);
  localStorage.removeItem(META_KEY);
  current = null;
}

/** Paketquelle für den Index; ohne Nachladepakete null (reiner Kern, alles unter worldUrl). */
export async function createPackSource(index: WorldIndex, worldUrl: string): Promise<PackSource | null> {
  if (!index.packs.some((p) => p.remote)) return null;
  const base = new URL(index.remoteBase ?? '../world-remote/', worldUrl).href;
  return new PackSource(index, base, {
    fetch: (url) => fetch(url),
    store: await regionCache(index.buildVersion),
    sha256: sha256Hex,
  });
}
