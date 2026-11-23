/**
 * Auswahl für die Fernsicht (Spec world-streaming „Fernsicht“), reine Logik ohne Babylon:
 * - welche hohen Gebäude als Silhouette erscheinen (nur dort, wo keine Ring-0/1-Kachel Gebäude zeigt)
 * - Gitter des Fernsicht-Geländes, ausgedünnt auf einen gröberen Abstand
 */
import { farHeightAt, type FarTerrain } from '@kandern/world-format';

export interface SilhouetteSource {
  x: number;
  z: number;
  h: number;
  w: number;
  d: number;
}

/** Indizes der Silhouetten im Umkreis `range`, ohne die, deren Kachel schon Gebäude zeigt (Ring 0/1). */
export function visibleSilhouettes(
  list: SilhouetteSource[],
  x: number,
  z: number,
  range: number,
  ringAt: (x: number, z: number) => number | null,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (Math.hypot(e.x - x, e.z - z) > range) continue;
    const ring = ringAt(e.x, e.z);
    if (ring === 0 || ring === 1) continue;
    out.push(i);
  }
  return out;
}

/**
 * Gitter des Fernsicht-Geländes mit jedem `every`-ten Rasterpunkt. Punkte ohne Daten bekommen die Höhe
 * des nächsten Nachbarn mit Daten in der Zeile (oder `fallback`); Dreiecke ganz ohne Daten entfallen.
 */
export function farGrid(
  f: FarTerrain,
  every: number,
  sink = 4,
  fallback = 250,
): { positions: Float32Array; indices: Uint32Array; heights: Float32Array } {
  const cols = Math.floor((f.cols - 1) / every) + 1,
    rows = Math.floor((f.rows - 1) / every) + 1;
  const positions = new Float32Array(cols * rows * 3);
  const heights = new Float32Array(cols * rows);
  const has = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    let last: number | null = null;
    for (let c = 0; c < cols; c++) {
      const h = farHeightAt(f, c * every, r * every);
      const k = r * cols + c;
      has[k] = h === null ? 0 : 1;
      if (h !== null) last = h;
      heights[k] = h ?? last ?? fallback;
      positions[k * 3] = f.minX + c * every * f.step;
      positions[k * 3 + 1] = heights[k] - sink;
      positions[k * 3 + 2] = f.minZ + r * every * f.step;
    }
  }
  const idx: number[] = [];
  for (let r = 0; r + 1 < rows; r++)
    for (let c = 0; c + 1 < cols; c++) {
      const a = r * cols + c,
        b = a + 1,
        d = a + cols,
        e = d + 1;
      if (!(has[a] || has[b] || has[d] || has[e])) continue;
      idx.push(a, d, b, b, d, e);
    }
  return { positions, indices: new Uint32Array(idx), heights };
}

/** Quader einer Silhouette in Weltlage: Mitte, Größe und Gierwinkel (Babylon: RotationY). */
export interface SilhouetteBox {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  yaw: number;
}

/** Vereinfachte Form eines Wahrzeichens: Quader [lx, y, lz, sx, sy, sz] im Modellsystem (Mitte, Größe). */
export type SilhouetteShape = number[][];

/**
 * Quader für die gewählten Einträge: Wahrzeichen mit Form -> deren Quader, gedreht nach der Längsachse
 * (ux, uz); sonst ein Quader nach Ausdehnung und Höhe. `ground` = Geländehöhe am Fußpunkt.
 */
export function silhouetteBoxes(
  list: (SilhouetteSource & { landmarkId?: string })[],
  pick: number[],
  shapes: Record<string, SilhouetteShape>,
  landmarks: Map<string, { x: number; z: number; ux: number; uz: number }>,
  ground: (x: number, z: number) => number,
): SilhouetteBox[] {
  const out: SilhouetteBox[] = [];
  for (const i of pick) {
    const e = list[i];
    const shape = e.landmarkId ? shapes[e.landmarkId] : undefined;
    const lm = e.landmarkId ? landmarks.get(e.landmarkId) : undefined;
    if (shape?.length && lm) {
      const g = ground(lm.x, lm.z);
      const yaw = Math.atan2(-lm.uz, lm.ux);
      for (const [lx, y, lz, sx, sy, sz] of shape)
        out.push({ x: lm.x + lx * lm.ux - lz * lm.uz, y: g + y, z: lm.z + lx * lm.uz + lz * lm.ux, sx, sy, sz, yaw });
    } else {
      const g = ground(e.x, e.z);
      out.push({ x: e.x, y: g + e.h / 2, z: e.z, sx: e.w, sy: e.h, sz: e.d, yaw: 0 });
    }
  }
  return out;
}
