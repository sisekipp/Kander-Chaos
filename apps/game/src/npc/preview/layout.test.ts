import { describe, expect, it } from 'vite-plus/test';
import { previewLayout, vatSettings } from './layout.ts';

const vat = {
  file: 'a.vat.bin',
  width: 56,
  height: 100,
  fps: 30,
  clips: { idle: { from: 0, to: 60 }, walk: { from: 61, to: 91 } },
};

describe('NPC-Testansicht', () => {
  it('alle Modelle nebeneinander, mittig, je Modell mehrere Reihen', () => {
    const s = previewLayout(['a', 'b', 'c'], 2, 1);
    expect(s).toHaveLength(6);
    expect(s.filter((p) => p.z === 0).map((p) => p.x)).toEqual([-1, 0, 1]);
    expect(s.filter((p) => p.model === 'b').map((p) => p.clip)).toEqual(['walk', 'wave']);
  });

  it('Bildbereich des Clips, Versatz innerhalb des Zyklus, fehlender Clip -> Gehen', () => {
    expect(vatSettings(vat, 'idle', 0)).toEqual([0, 60, 0, 30]);
    expect(vatSettings(vat, 'walk', 5)).toEqual([61, 91, 4, 30]);
    expect(vatSettings(vat, 'wave', 1)).toEqual([61, 91, 7, 30]);
  });
});
