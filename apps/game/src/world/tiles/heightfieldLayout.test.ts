import { describe, expect, it } from 'vite-plus/test';
import { toHavokHeightfield } from './heightfieldLayout.ts';

describe('Havok-Höhenraster', () => {
  it('spiegelt die Zeilen (z) und rechnet relativ zum Minimum', () => {
    // 2x2: Zeile j=0 (Süd): 10, 11; Zeile j=1 (Nord): 12, 13
    const { data, min } = toHavokHeightfield(new Float32Array([10, 11, 12, 13]), 2);
    expect(min).toBe(10);
    expect([...data]).toEqual([2, 3, 0, 1]);
  });
});
