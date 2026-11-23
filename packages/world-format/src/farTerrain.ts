/**
 * Fernsicht-Gelände (Spec world-streaming „Fernsicht“): grobes Höhenraster der ganzen Region (Standard 64 m),
 * damit im Flug auch jenseits der geladenen Kacheln Berge und Täler zu sehen sind. Klein genug für den Kern.
 * Aufbau: Magic „KCFT“, Version, Ursprung (Südwest-Ecke, m), Spalten, Zeilen, Abstand, Höhenbasis und -schritt,
 * danach u16-Höhen zeilenweise von Süd nach Nord (0xFFFF = keine Daten).
 */
import { ByteReader, ByteWriter } from './bytes.ts';

export const FAR_TERRAIN_NODATA = 0xffff;

export interface FarTerrain {
  minX: number;
  minZ: number;
  cols: number;
  rows: number;
  step: number;
  base: number;
  scale: number;
  /** Quantisierte Höhen, Index = row * cols + col. */
  heights: Uint16Array;
}

export function encodeFarTerrain(f: FarTerrain): Uint8Array {
  const w = new ByteWriter(32 + f.heights.length * 2);
  for (const c of 'KCFT') w.u8v(c.charCodeAt(0));
  w.u16(1);
  w.i32(Math.round(f.minX));
  w.i32(Math.round(f.minZ));
  w.u16(f.cols);
  w.u16(f.rows);
  w.u16(f.step);
  w.f32(f.base);
  w.f32(f.scale);
  for (const h of f.heights) w.u16(h);
  return w.finish();
}

export function decodeFarTerrain(bytes: Uint8Array): FarTerrain {
  const r = new ByteReader(bytes);
  const magic = String.fromCharCode(r.u8v(), r.u8v(), r.u8v(), r.u8v());
  if (magic !== 'KCFT') throw new Error('keine Fernsicht-Datei');
  const version = r.u16();
  if (version !== 1) throw new Error(`Fernsicht-Version ${version} unbekannt`);
  const minX = r.i32(),
    minZ = r.i32(),
    cols = r.u16(),
    rows = r.u16(),
    step = r.u16(),
    base = r.f32(),
    scale = r.f32();
  const heights = new Uint16Array(cols * rows);
  for (let i = 0; i < heights.length; i++) heights[i] = r.u16();
  return { minX, minZ, cols, rows, step, base, scale, heights };
}

/** Höhe in m an Rasterpunkt oder null ohne Daten. */
export function farHeightAt(f: FarTerrain, col: number, row: number): number | null {
  if (col < 0 || row < 0 || col >= f.cols || row >= f.rows) return null;
  const q = f.heights[row * f.cols + col];
  return q === FAR_TERRAIN_NODATA ? null : f.base + q * f.scale;
}

/** Baut das Raster aus einer Höhenfunktion (null = keine Daten). */
export function buildFarTerrain(
  rect: { minX: number; minZ: number; maxX: number; maxZ: number },
  step: number,
  height: (x: number, z: number) => number | null,
  quant = { base: -100, scale: 0.05 },
): FarTerrain {
  const cols = Math.floor((rect.maxX - rect.minX) / step) + 1;
  const rows = Math.floor((rect.maxZ - rect.minZ) / step) + 1;
  const heights = new Uint16Array(cols * rows);
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const h = height(rect.minX + col * step, rect.minZ + row * step);
      heights[row * cols + col] =
        h === null
          ? FAR_TERRAIN_NODATA
          : Math.min(FAR_TERRAIN_NODATA - 1, Math.max(0, Math.round((h - quant.base) / quant.scale)));
    }
  return { minX: rect.minX, minZ: rect.minZ, cols, rows, step, base: quant.base, scale: quant.scale, heights };
}
