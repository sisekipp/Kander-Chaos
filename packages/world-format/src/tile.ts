import { ByteReader, ByteWriter } from './bytes.ts';
import {
  FORMAT_VERSION,
  TILE_MAGIC,
  type Building,
  type HeightLod,
  type LandArea,
  type Road,
  type TileData,
  type Waterway,
} from './types.ts';

/** Abschnittskennungen innerhalb eines Kachelblocks. Unbekannte Abschnitte werden übersprungen. */
const enum Section {
  Terrain = 1,
  Buildings = 2,
  Roads = 3,
  Land = 4,
  Waterways = 5,
}

const WATER_KINDS: Waterway['kind'][] = ['river', 'stream', 'ditch'];

function writeSection(w: ByteWriter, id: Section, body: (w: ByteWriter) => void): void {
  const inner = new ByteWriter(16 * 1024);
  body(inner);
  const bytes = inner.finish();
  w.u16(id);
  w.u32(bytes.length);
  w.bytes(bytes);
}

/** Serialisiert eine Kachel (unkomprimiert). Ausgabe ist deterministisch für gleiche Eingaben. */
export function encodeTile(t: TileData): Uint8Array {
  const w = new ByteWriter();
  w.u32(TILE_MAGIC);
  w.u16(FORMAT_VERSION);
  w.i32(t.tx);
  w.i32(t.tz);
  w.f32(t.size);
  w.f32(t.quant.base);
  w.f32(t.quant.step);

  writeSection(w, Section.Terrain, (s) => {
    s.u8v(t.lods.length);
    for (const lod of t.lods) {
      if (lod.heights.length !== lod.samples * lod.samples) {
        throw new Error(`Höhenraster ${t.tx},${t.tz}: ${lod.heights.length} != ${lod.samples}²`);
      }
      s.u16(lod.samples);
      s.u16Array(lod.heights);
    }
  });

  writeSection(w, Section.Buildings, (s) => {
    s.u32(t.buildings.length);
    for (const b of t.buildings) {
      s.f64(b.id);
      s.u8v(b.type);
      s.u8v(b.roof);
      s.u8v(b.levels);
      s.u8v(b.estimated ? 1 : 0);
      s.f32(b.wallHeight);
      s.f32(b.roofHeight);
      s.f32Array(b.outline);
    }
  });

  writeSection(w, Section.Roads, (s) => {
    s.u32(t.roads.length);
    for (const r of t.roads) {
      s.f64(r.id);
      s.u8v(r.kind);
      s.u8v((r.bridge ? 1 : 0) | (r.tunnel ? 2 : 0));
      s.f32(r.width);
      s.f64(r.startNode);
      s.f64(r.endNode);
      s.str(r.name);
      s.f32Array(r.points);
    }
  });

  writeSection(w, Section.Land, (s) => {
    s.u32(t.land.length);
    for (const a of t.land) {
      s.u8v(a.kind);
      s.u16(a.rings.length);
      for (const ring of a.rings) s.f32Array(ring);
    }
  });

  writeSection(w, Section.Waterways, (s) => {
    s.u32(t.waterways.length);
    for (const ww of t.waterways) {
      s.u8v(WATER_KINDS.indexOf(ww.kind));
      s.f32(ww.width);
      s.str(ww.name);
      s.f32Array(ww.points);
    }
  });

  return w.finish();
}

/** Liest einen unkomprimierten Kachelblock. Wirft bei falscher Kennung oder neuerer Formatversion. */
export function decodeTile(bytes: Uint8Array): TileData {
  const r = new ByteReader(bytes);
  if (r.u32() !== TILE_MAGIC) throw new Error('Keine Kandern-Chaos-Kachel (falsche Kennung)');
  const version = r.u16();
  if (version > FORMAT_VERSION)
    throw new Error(`Kachelformat ${version} ist neuer als unterstützt (${FORMAT_VERSION})`);
  const t: TileData = {
    tx: r.i32(),
    tz: r.i32(),
    size: r.f32(),
    quant: { base: r.f32(), step: r.f32() },
    lods: [],
    buildings: [],
    roads: [],
    land: [],
    waterways: [],
  };

  while (r.remaining > 0) {
    const id = r.u16();
    const len = r.u32();
    const body = new ByteReader(bytes.subarray(r.pos, r.pos + len));
    r.pos += len;
    switch (id) {
      case Section.Terrain: {
        const n = body.u8v();
        for (let i = 0; i < n; i++) {
          const samples = body.u16();
          const lod: HeightLod = { samples, heights: body.u16Array() };
          t.lods.push(lod);
        }
        break;
      }
      case Section.Buildings: {
        const n = body.u32();
        for (let i = 0; i < n; i++) {
          const id = body.f64();
          const type = body.u8v();
          const roof = body.u8v();
          const levels = body.u8v();
          const estimated = body.u8v() === 1;
          const b: Building = {
            id,
            type,
            roof,
            levels,
            estimated,
            wallHeight: body.f32(),
            roofHeight: body.f32(),
            outline: body.f32Array(),
          };
          t.buildings.push(b);
        }
        break;
      }
      case Section.Roads: {
        const n = body.u32();
        for (let i = 0; i < n; i++) {
          const id = body.f64();
          const kind = body.u8v();
          const flags = body.u8v();
          const road: Road = {
            id,
            kind,
            bridge: (flags & 1) !== 0,
            tunnel: (flags & 2) !== 0,
            width: body.f32(),
            startNode: body.f64(),
            endNode: body.f64(),
            name: body.str(),
            points: body.f32Array(),
          };
          t.roads.push(road);
        }
        break;
      }
      case Section.Land: {
        const n = body.u32();
        for (let i = 0; i < n; i++) {
          const kind = body.u8v();
          const rc = body.u16();
          const rings: Float32Array[] = [];
          for (let k = 0; k < rc; k++) rings.push(body.f32Array());
          const a: LandArea = { kind, rings };
          t.land.push(a);
        }
        break;
      }
      case Section.Waterways: {
        const n = body.u32();
        for (let i = 0; i < n; i++) {
          const kind = WATER_KINDS[body.u8v()] ?? 'stream';
          const ww: Waterway = { kind, width: body.f32(), name: body.str(), points: body.f32Array() };
          t.waterways.push(ww);
        }
        break;
      }
      default:
        // Unbekannter Abschnitt aus neuerer Minor-Version: überspringen.
        break;
    }
  }
  return t;
}

/** Höhe in Metern an Rasterpunkt (i = Spalte West->Ost, j = Zeile Süd->Nord). */
export function heightAt(t: Pick<TileData, 'quant'>, lod: HeightLod, i: number, j: number): number {
  return t.quant.base + lod.heights[j * lod.samples + i] * t.quant.step;
}

/** Bilineare Höhe an Kachel-lokaler Position (lx, lz) in Metern. */
export function sampleHeight(t: Pick<TileData, 'quant' | 'size'>, lod: HeightLod, lx: number, lz: number): number {
  const n = lod.samples - 1;
  const fx = Math.min(Math.max((lx / t.size) * n, 0), n);
  const fz = Math.min(Math.max((lz / t.size) * n, 0), n);
  const i0 = Math.min(Math.floor(fx), n - 1);
  const j0 = Math.min(Math.floor(fz), n - 1);
  const ax = fx - i0;
  const az = fz - j0;
  const h00 = heightAt(t, lod, i0, j0);
  const h10 = heightAt(t, lod, i0 + 1, j0);
  const h01 = heightAt(t, lod, i0, j0 + 1);
  const h11 = heightAt(t, lod, i0 + 1, j0 + 1);
  return (h00 * (1 - ax) + h10 * ax) * (1 - az) + (h01 * (1 - ax) + h11 * ax) * az;
}

export function quantizeHeight(q: { base: number; step: number }, h: number): number {
  return Math.min(65535, Math.max(0, Math.round((h - q.base) / q.step)));
}
