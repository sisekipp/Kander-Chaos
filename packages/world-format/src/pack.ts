import { gunzipSync, gzipSync } from 'fflate';
import { decodeTile, encodeTile } from './tile.ts';
import {
  FORMAT_VERSION,
  parseTileId,
  tileId,
  type PackEntry,
  type TileData,
  type TileLocation,
  type WorldIndex,
} from './types.ts';

/**
 * Regionspaket = Aneinanderreihung einzeln gzip-komprimierter Kachelblöcke.
 * Einzeln komprimiert, damit eine Kachel per Byte-Bereich (Blob.slice) gelesen werden kann,
 * ohne das ganze Paket zu entpacken.
 */
export interface BuiltPack {
  bytes: Uint8Array;
  /** Kachel-ID -> [Offset, Länge] innerhalb dieses Pakets. */
  tiles: Map<string, [number, number]>;
}

/** gzip mit fester mtime (0) -> deterministische Ausgabe. */
export function compressBlock(raw: Uint8Array): Uint8Array {
  return gzipSync(raw, { level: 9, mtime: 0 });
}

export function decompressBlock(gz: Uint8Array): Uint8Array {
  return gunzipSync(gz);
}

/** Baut ein Paket aus Kacheln. Reihenfolge wird nach Kachel-ID stabil sortiert. */
export function buildPack(tiles: TileData[]): BuiltPack {
  const sorted = [...tiles].sort((a, b) => a.tz - b.tz || a.tx - b.tx);
  const blocks = sorted.map((t) => ({ id: tileId(t.tx, t.tz), gz: compressBlock(encodeTile(t)) }));
  const total = blocks.reduce((s, b) => s + b.gz.length, 0);
  const bytes = new Uint8Array(total);
  const map = new Map<string, [number, number]>();
  let off = 0;
  for (const b of blocks) {
    bytes.set(b.gz, off);
    map.set(b.id, [off, b.gz.length]);
    off += b.gz.length;
  }
  return { bytes, tiles: map };
}

/** Liest eine Kachel aus einem kompletten Paket-Puffer. */
export function readTileFromPack(pack: Uint8Array, loc: TileLocation): TileData {
  const [, offset, length] = loc;
  return decodeTile(decompressBlock(pack.subarray(offset, offset + length)));
}

/** SHA-256 als Hex – läuft in Node 20+ und im Browser (WebCrypto). */
export async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPack(entry: PackEntry, bytes: Uint8Array): Promise<boolean> {
  return bytes.length === entry.bytes && (await sha256Hex(bytes)) === entry.sha256;
}

export interface IndexInput {
  packs: { file: string; pack: BuiltPack }[];
  sourceDate: string;
  tileSize: number;
  quant: WorldIndex['quant'];
  origin: WorldIndex['origin'];
  spawn: WorldIndex['spawn'];
}

/** Erzeugt den Weltindex inkl. Hashes; buildVersion = Hash über alle Paket-Hashes. */
export async function buildWorldIndex(input: IndexInput): Promise<WorldIndex> {
  const packs: PackEntry[] = [];
  const tiles: Record<string, TileLocation> = {};
  let minTx = Infinity,
    minTz = Infinity,
    maxTx = -Infinity,
    maxTz = -Infinity;
  for (const [i, { file, pack }] of input.packs.entries()) {
    packs.push({ file, bytes: pack.bytes.length, sha256: await sha256Hex(pack.bytes) });
    for (const [id, [off, len]] of [...pack.tiles.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
      tiles[id] = [i, off, len];
      const { tx, tz } = parseTileId(id);
      minTx = Math.min(minTx, tx);
      minTz = Math.min(minTz, tz);
      maxTx = Math.max(maxTx, tx);
      maxTz = Math.max(maxTz, tz);
    }
  }
  const buildVersion = (await sha256Hex(new TextEncoder().encode(packs.map((p) => p.sha256).join('')))).slice(0, 16);
  return {
    formatVersion: FORMAT_VERSION,
    buildVersion,
    sourceDate: input.sourceDate,
    tileSize: input.tileSize,
    quant: input.quant,
    origin: input.origin,
    bounds: { minTx, minTz, maxTx, maxTz },
    spawn: input.spawn,
    packs,
    tiles,
  };
}
