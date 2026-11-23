/**
 * Höhen mehrerer Länder zusammenführen (Design D2): Das LGL-Raster hat Vorrang; Punkte ohne deutsche Daten
 * nehmen die ausländische Quelle (Schweiz bzw. Frankreich). In einem Streifen von `band` Rasterpunkten
 * diesseits der Datengrenze wird linear übergeblendet, damit an der Landesgrenze keine Stufe entsteht.
 */

/** Chamfer-Abstand (in Rasterpunkten, gedeckelt auf `cap`) jedes Punkts mit Daten zum nächsten Punkt ohne. */
export function distanceToMissing(has: Uint8Array, cols: number, rows: number, cap: number): Uint16Array {
  const d = new Uint16Array(cols * rows);
  for (let k = 0; k < d.length; k++) d[k] = has[k] ? cap : 0;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      if (!d[k]) continue;
      if (i > 0) d[k] = Math.min(d[k], d[k - 1] + 1);
      if (j > 0) d[k] = Math.min(d[k], d[k - cols] + 1);
    }
  for (let j = rows - 1; j >= 0; j--)
    for (let i = cols - 1; i >= 0; i--) {
      const k = j * cols + i;
      if (!d[k]) continue;
      if (i < cols - 1) d[k] = Math.min(d[k], d[k + 1] + 1);
      if (j < rows - 1) d[k] = Math.min(d[k], d[k + cols] + 1);
    }
  return d;
}

/**
 * Füllt Lücken aus `foreign(i, j)` (NaN = keine Daten) und blendet am Rand über. Ändert `h` und `has`.
 * Gibt die Zahl der gefüllten Punkte zurück.
 */
export function blendForeign(
  h: Float32Array,
  has: Uint8Array,
  cols: number,
  rows: number,
  foreign: (i: number, j: number) => number,
  band = 15,
): number {
  const dist = distanceToMissing(has, cols, rows, band);
  let filled = 0;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      if (has[k] && dist[k] >= band) continue;
      const f = foreign(i, j);
      if (Number.isNaN(f)) continue;
      if (!has[k]) {
        h[k] = f;
        has[k] = 2;
        filled++;
      } else {
        const t = dist[k] / band;
        h[k] = f * (1 - t) + h[k] * t;
      }
    }
  return filled;
}
