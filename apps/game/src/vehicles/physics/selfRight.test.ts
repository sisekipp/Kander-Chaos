import { describe, expect, it } from 'vite-plus/test';
import { SelfRightTimer } from './selfRight.ts';

describe('Selbstaufrichten', () => {
  it('nach 2 s auf dem Dach', () => {
    const t = new SelfRightTimer();
    let fired = false;
    for (let i = 0; i < 59; i++) fired ||= t.update(1 / 30, 0, -1, 0);
    expect(fired).toBe(false);
    expect(t.update(1 / 30, 0, -1, 0) || t.update(1 / 30, 0, -1, 0)).toBe(true);
  });

  it('nicht während eines Sprungs in voller Fahrt und nicht aufrecht auf den Rädern', () => {
    const t = new SelfRightTimer();
    for (let i = 0; i < 120; i++) expect(t.update(1 / 30, 0, 0.95, 20)).toBe(false);
    for (let i = 0; i < 120; i++) expect(t.update(1 / 30, 4, 1, 0)).toBe(false);
  });

  it('Kontakt setzt den Zähler zurück', () => {
    const t = new SelfRightTimer();
    for (let i = 0; i < 50; i++) t.update(1 / 30, 0, -1, 0);
    t.update(1 / 30, 4, 1, 0);
    for (let i = 0; i < 50; i++) expect(t.update(1 / 30, 0, -1, 0)).toBe(false);
  });
});
