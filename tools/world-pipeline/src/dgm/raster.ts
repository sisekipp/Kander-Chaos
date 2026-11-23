/** Höhenkacheln fremder Quellen (reine Rechnung): Abtasten, Kachelsuche, Ausschnitte. */

/** Rasterkachel, Zeilen von Nord nach Süd; (x0, yTop) = Außenkante oben links, Punkte in Zellmitten. */
export interface RasterTile {
  x0: number;
  yTop: number;
  step: number;
  cols: number;
  rows: number;
  data: Float32Array;
  /** Werte unterhalb gelten als „keine Daten“. */
  nodataBelow: number;
}

/** Bilineare Höhe an (x, y) oder NaN außerhalb bzw. bei fehlenden Daten. */
export function sampleTile(t: RasterTile, x: number, y: number): number {
  const fx = (x - t.x0) / t.step - 0.5;
  const fy = (t.yTop - y) / t.step - 0.5;
  if (fx < -0.5 || fy < -0.5 || fx > t.cols - 0.5 || fy > t.rows - 0.5) return NaN;
  const i0 = Math.max(0, Math.min(t.cols - 2, Math.floor(fx)));
  const j0 = Math.max(0, Math.min(t.rows - 2, Math.floor(fy)));
  const ax = Math.min(1, Math.max(0, fx - i0)),
    ay = Math.min(1, Math.max(0, fy - j0));
  const d = t.data,
    c = t.cols,
    k = j0 * c + i0;
  const v = [d[k], d[k + 1], d[k + c], d[k + c + 1]];
  if (v.some((h) => !(h > t.nodataBelow))) return NaN;
  return (v[0] * (1 - ax) + v[1] * ax) * (1 - ay) + (v[2] * (1 - ax) + v[3] * ax) * ay;
}

/** Kacheln in einem regelmäßigen Gitter (Kantenlänge `size`), nachschlagbar über Index. */
export class TileIndex {
  private readonly tiles = new Map<string, RasterTile>();
  constructor(private readonly size: number) {}
  private key(x: number, y: number): string {
    return `${Math.floor(x / this.size)}/${Math.floor(y / this.size)}`;
  }
  /** Kachel anhand ihrer Südwestecke eintragen. */
  add(t: RasterTile): void {
    this.tiles.set(this.key(t.x0 + 1e-6, t.yTop - this.size + 1e-6), t);
  }
  get count(): number {
    return this.tiles.size;
  }
  sample(x: number, y: number): number {
    const t = this.tiles.get(this.key(x, y));
    return t ? sampleTile(t, x, y) : NaN;
  }
}

/** swissALTI3D-Kachelname „swissalti3d_2019_2610-1266“ -> Jahr und Südwestecke in LV95 (m). */
export function parseSwissItem(id: string): { year: number; e: number; n: number; tile: string } | null {
  const m = /_(\d{4})_(\d{4})-(\d{4})$/.exec(id);
  return m ? { year: +m[1], e: +m[2] * 1000, n: +m[3] * 1000, tile: `${m[2]}-${m[3]}` } : null;
}

/** Je Kachel nur den neuesten Jahrgang behalten. */
export function newestPerTile<T extends { id: string }>(items: T[]): T[] {
  const best = new Map<string, { year: number; item: T }>();
  for (const it of items) {
    const p = parseSwissItem(it.id);
    if (!p) continue;
    const cur = best.get(p.tile);
    if (!cur || p.year > cur.year) best.set(p.tile, { year: p.year, item: it });
  }
  return [...best.values()].map((b) => b.item).sort((a, b) => a.id.localeCompare(b.id));
}

/** Quadratische Ausschnitte (Kantenlänge `size`) über einem Rechteck, auf das Gitter gerundet. */
export function pieces(minX: number, minY: number, maxX: number, maxY: number, size: number): [number, number][] {
  const out: [number, number][] = [];
  for (let y = Math.floor(minY / size) * size; y < maxY; y += size)
    for (let x = Math.floor(minX / size) * size; x < maxX; x += size) out.push([x, y]);
  return out;
}
