import { describe, expect, it } from 'vite-plus/test';
import { SaveValidationError, newSave, parseSave, parseSaveFile } from './saveGame.ts';

describe('Spielstand', () => {
  it('Round-Trip über Export/Import', () => {
    const s = newSave({ x: 12.5, z: -40, yaw: 1 }, 'high', 'abc');
    const back = parseSaveFile(JSON.stringify(s));
    expect(back.player).toEqual({ x: 12.5, z: -40, yaw: 1 });
    expect(back.settings.quality).toBe('high');
  });

  it('lehnt beschädigte und fremde Dateien verständlich ab', () => {
    expect(() => parseSaveFile('{"kind": "kandern-chaos-spiel')).toThrow(SaveValidationError);
    expect(() => parseSaveFile('{"hello": 1}')).toThrow(/kein Kandern-Chaos-Spielstand/);
    expect(() => parseSave({ kind: 'kandern-chaos-spielstand', schemaVersion: 99, player: { x: 0, z: 0 } })).toThrow(
      /neueren Spielversion/,
    );
    expect(() => parseSave({ kind: 'kandern-chaos-spielstand', schemaVersion: 1, player: { x: 'a', z: 0 } })).toThrow(
      /beschädigt/,
    );
  });

  it('ergänzt fehlende optionale Felder', () => {
    const s = parseSave({ kind: 'kandern-chaos-spielstand', schemaVersion: 1, player: { x: 1, z: 2 } });
    expect(s.player.yaw).toBe(0);
    expect(s.settings.quality).toBe('low');
    expect(s.progress).toEqual({});
  });
});
