import { describe, expect, it } from 'vite-plus/test';
import { fullDetailFor } from './detailRule.ts';

describe('Detailstufe nach Flughöhe', () => {
  it('aus über 120 m, wieder an unter 100 m', () => {
    expect(fullDetailFor(true, 121)).toBe(false);
    expect(fullDetailFor(false, 99)).toBe(true);
  });
  it('dazwischen bleibt der Zustand (kein Flackern)', () => {
    expect(fullDetailFor(true, 110)).toBe(true);
    expect(fullDetailFor(false, 110)).toBe(false);
  });
});
