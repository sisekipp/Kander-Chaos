/**
 * Globales 2-m-Höhenraster in UTM. Gitterpunkte liegen auf geraden ganzzahligen Koordinaten;
 * jeder Wert ist der Mittelwert der vier umgebenden 1-m-DGM-Punkte (Zellmitten bei x.5).
 */
export class DgmGrid {
  private constructor(
    readonly e0: number,
    readonly n0: number,
    readonly cols: number,
    readonly rows: number,
    readonly h: Float32Array,
    private cnt: Uint8Array | null,
  ) {}

  holes = 0;

  static create(minE: number, minN: number, maxE: number, maxN: number): DgmGrid {
    const cols = (maxE - minE) / 2 + 1;
    const rows = (maxN - minN) / 2 + 1;
    return new DgmGrid(minE, minN, cols, rows, new Float32Array(cols * rows), new Uint8Array(cols * rows));
  }

  /** 1-m-Punkt (Zellmitte x.5) zu den nächstgelegenen geraden Gitterpunkten beitragen lassen. */
  accumulate(e: number, n: number, h: number): void {
    // Punkte bei G-0.5 und G+0.5 (je Achse) gehören zum geraden Gitterpunkt G: round((x-e0)/2).
    const gi = Math.round((e - this.e0) / 2);
    const gj = Math.round((n - this.n0) / 2);
    if (gi < 0 || gj < 0 || gi >= this.cols || gj >= this.rows) return;
    const k = gj * this.cols + gi;
    this.h[k] += h;
    this.cnt![k]++;
  }

  /** Mittelwerte bilden, Lücken (keine Daten) per Nachbarschafts-Füllung schließen. */
  finalize(): void {
    const cnt = this.cnt!;
    const nan = new Uint8Array(this.h.length);
    for (let k = 0; k < this.h.length; k++) {
      if (cnt[k] > 0) this.h[k] /= cnt[k];
      else {
        nan[k] = 1;
        this.holes++;
      }
    }
    // Iterativ mit Mittel der gültigen Nachbarn füllen (Lücken sind selten: Landesgrenze, Wasser)
    let remaining = this.holes;
    let guard = 0;
    while (remaining > 0 && guard++ < 5000) {
      let filled = 0;
      for (let j = 0; j < this.rows; j++) {
        for (let i = 0; i < this.cols; i++) {
          const k = j * this.cols + i;
          if (!nan[k]) continue;
          let s = 0,
            c = 0;
          for (const [di, dj] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const ii = i + di,
              jj = j + dj;
            if (ii < 0 || jj < 0 || ii >= this.cols || jj >= this.rows) continue;
            const kk = jj * this.cols + ii;
            if (nan[kk] === 0) {
              s += this.h[kk];
              c++;
            }
          }
          if (c > 0) {
            this.h[k] = s / c;
            nan[k] = 2;
            filled++;
          }
        }
      }
      for (let k = 0; k < nan.length; k++) if (nan[k] === 2) nan[k] = 0;
      remaining -= filled;
      if (filled === 0) break;
    }
    if (remaining > 0) for (let k = 0; k < nan.length; k++) if (nan[k]) this.h[k] = 300;
    this.cnt = null;
  }

  /** Bilineare Höhe an UTM-Position. */
  sample(e: number, n: number): number {
    const fx = Math.min(Math.max((e - this.e0) / 2, 0), this.cols - 1);
    const fz = Math.min(Math.max((n - this.n0) / 2, 0), this.rows - 1);
    const i0 = Math.min(Math.floor(fx), this.cols - 2),
      j0 = Math.min(Math.floor(fz), this.rows - 2);
    const ax = fx - i0,
      az = fz - j0;
    const c = this.cols,
      h = this.h;
    const k = j0 * c + i0;
    return (h[k] * (1 - ax) + h[k + 1] * ax) * (1 - az) + (h[k + c] * (1 - ax) + h[k + c + 1] * ax) * az;
  }

  serialize(): Buffer {
    const head = Buffer.alloc(16);
    head.writeInt32LE(this.e0, 0);
    head.writeInt32LE(this.n0, 4);
    head.writeInt32LE(this.cols, 8);
    head.writeInt32LE(this.rows, 12);
    return Buffer.concat([head, Buffer.from(this.h.buffer, this.h.byteOffset, this.h.byteLength)]);
  }

  static deserialize(buf: Buffer): DgmGrid {
    const e0 = buf.readInt32LE(0),
      n0 = buf.readInt32LE(4),
      cols = buf.readInt32LE(8),
      rows = buf.readInt32LE(12);
    const h = new Float32Array(cols * rows);
    new Uint8Array(h.buffer).set(buf.subarray(16, 16 + h.byteLength));
    return new DgmGrid(e0, n0, cols, rows, h, null);
  }

  static fromFunction(
    e0: number,
    n0: number,
    cols: number,
    rows: number,
    fn: (e: number, n: number) => number,
  ): DgmGrid {
    const h = new Float32Array(cols * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) h[j * cols + i] = fn(e0 + i * 2, n0 + j * 2);
    return new DgmGrid(e0, n0, cols, rows, h, null);
  }
}
