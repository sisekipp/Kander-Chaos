import { describe, expect, it } from 'vite-plus/test';
import { blendForeign, distanceToMissing } from './merge.ts';

/** 40 × 10 Punkte: linke Hälfte deutsche Daten (100 m), rechte Hälfte ohne. */
function grid() {
  const cols = 40,
    rows = 10;
  const h = new Float32Array(cols * rows);
  const has = new Uint8Array(cols * rows);
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < 20; i++) {
      h[j * cols + i] = 100;
      has[j * cols + i] = 1;
    }
  return { cols, rows, h, has };
}

describe('Höhen zusammenführen', () => {
  it('Abstand zum nächsten Punkt ohne Daten, gedeckelt', () => {
    const { cols, rows, has } = grid();
    const d = distanceToMissing(has, cols, rows, 15);
    expect(d[19]).toBe(1);
    expect(d[10]).toBe(10);
    expect(d[0]).toBe(15);
    expect(d[25]).toBe(0);
  });

  it('füllt Lücken aus der ausländischen Quelle und blendet ohne Stufe über', () => {
    const { cols, rows, h, has } = grid();
    const n = blendForeign(h, has, cols, rows, () => 110, 15);
    expect(n).toBe(20 * rows);
    expect(h[30]).toBe(110);
    expect(h[0]).toBe(100); // weit weg von der Grenze unverändert
    let maxStep = 0;
    for (let i = 1; i < cols; i++) maxStep = Math.max(maxStep, Math.abs(h[i] - h[i - 1]));
    expect(maxStep).toBeLessThanOrEqual(1); // 10 m Unterschied auf 15 Punkte verteilt
  });

  it('ohne ausländische Daten bleibt die Lücke (wird später durch Nachbarn gefüllt)', () => {
    const { cols, rows, h, has } = grid();
    expect(blendForeign(h, has, cols, rows, () => NaN)).toBe(0);
    expect(has[30]).toBe(0);
  });
});
