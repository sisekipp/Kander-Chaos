import { describe, expect, it } from 'vite-plus/test';
import { buildPack, readTileFromPack, sha256Hex, verifyPack } from './pack.ts';
import { makeTile } from './testFixtures.ts';
import type { TileLocation } from './types.ts';

describe('Regionspakete', () => {
  it('liest einzelne Kacheln per Offset und prüft den Hash', async () => {
    const pack = buildPack([makeTile(1, 1), makeTile(0, 0), makeTile(2, 0)]);
    expect(pack.tiles.size).toBe(3);
    const [off, len] = pack.tiles.get('1,1')!;
    const loc: TileLocation = [0, off, len];
    const t = readTileFromPack(pack.bytes, loc);
    expect([t.tx, t.tz]).toEqual([1, 1]);
    expect(t.roads[0].name).toBe('Hauptstraße');

    const entry = { file: 'p.bin', bytes: pack.bytes.length, sha256: await sha256Hex(pack.bytes) };
    expect(await verifyPack(entry, pack.bytes)).toBe(true);
    const broken = pack.bytes.slice();
    broken[5] ^= 0xff;
    expect(await verifyPack(entry, broken)).toBe(false);
  });

  it('ist unabhängig von der Eingabereihenfolge', async () => {
    const a = buildPack([makeTile(0, 0), makeTile(1, 0)]);
    const b = buildPack([makeTile(1, 0), makeTile(0, 0)]);
    expect(await sha256Hex(a.bytes)).toBe(await sha256Hex(b.bytes));
  });
});

describe('Weltindex', () => {
  it('enthält Pakete mit Hash, Kachelpositionen und Grenzen', async () => {
    const { buildWorldIndex } = await import('./pack.ts');
    const p0 = buildPack([makeTile(0, 0), makeTile(1, 0)]);
    const p1 = buildPack([makeTile(-1, 2)]);
    const idx = await buildWorldIndex({
      packs: [
        { file: 'a.bin', pack: p0 },
        { file: 'b.bin', pack: p1 },
      ],
      sourceDate: '2026-11-01',
      tileSize: 250,
      quant: { base: 150, step: 0.02 },
      origin: { epsg: 25832, easting: 400000, northing: 5290000 },
      spawn: { x: 0, z: 0 },
    });
    expect(idx.packs).toHaveLength(2);
    expect(idx.packs[1].sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(idx.tiles['-1,2'][0]).toBe(1);
    expect(idx.bounds).toEqual({ minTx: -1, minTz: 0, maxTx: 1, maxTz: 2 });
    expect(idx.sourceDate).toBe('2026-11-01');
    const t = readTileFromPack(p1.bytes, idx.tiles['-1,2']);
    expect([t.tx, t.tz]).toEqual([-1, 2]);
    expect(idx.buildVersion).toHaveLength(16);
  });
});
