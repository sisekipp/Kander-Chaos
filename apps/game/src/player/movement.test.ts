import { describe, expect, it } from 'vite-plus/test';
import { cameraRelativeMove } from './movement.ts';

describe('kamerarelative Bewegung', () => {
  it('vorwärts folgt der Blickrichtung', () => {
    const north = cameraRelativeMove(0, 1, 0);
    expect(north.mx).toBeCloseTo(0);
    expect(north.mz).toBeCloseTo(1);
    const east = cameraRelativeMove(0, 1, Math.PI / 2);
    expect(east.mx).toBeCloseTo(1);
    expect(east.mz).toBeCloseTo(0);
  });

  it('rechts ist bei Blick nach Norden Osten; Diagonale wird auf Länge 1 begrenzt', () => {
    const r = cameraRelativeMove(1, 0, 0);
    expect(r.mx).toBeCloseTo(1);
    const d = cameraRelativeMove(1, 1, 0);
    expect(Math.hypot(d.mx, d.mz)).toBeCloseTo(1);
    expect(d.len).toBe(1);
  });
});
