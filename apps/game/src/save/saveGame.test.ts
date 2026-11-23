import { describe, expect, it } from 'vite-plus/test';
import { SAVE_SCHEMA_VERSION, SaveValidationError, newSave, parseSave, parseSaveFile } from './saveGame.ts';

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

  it('Migration 1 -> 2: Standardvariante der Figur', () => {
    const v1 = { kind: 'kandern-chaos-spielstand', schemaVersion: 1, player: { x: 1, z: 2 }, figure: { variant: 4 } };
    const s = parseSave(v1);
    expect(s.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(SAVE_SCHEMA_VERSION).toBe(2);
    expect(s.figure).toEqual({ variant: 0 });
  });

  it('Figurvariante bleibt erhalten, ungültige Werte werden zur Standardvariante', () => {
    expect(parseSaveFile(JSON.stringify(newSave({ x: 0, z: 0, yaw: 0 }, 'low', 'v', {}, 3))).figure.variant).toBe(3);
    const bad = { kind: 'kandern-chaos-spielstand', schemaVersion: 2, player: { x: 0, z: 0 }, figure: { variant: 77 } };
    expect(parseSave(bad).figure.variant).toBe(0);
  });
});
