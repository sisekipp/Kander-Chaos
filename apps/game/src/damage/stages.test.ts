import { describe, expect, it } from 'vite-plus/test';
import { damageLook, healthColor } from './stages.ts';

describe('Schadensstufen', () => {
  it('heil: keine Spuren', () => {
    expect(damageLook(0.9, 4)).toEqual({ tint: 1, partsOff: 0, smoke: 'none', wrecked: false });
  });

  it('ab 70 % dunkler, ab 40 % Teile und dünner Rauch, ab 15 % dichter Rauch', () => {
    expect(damageLook(0.6, 4).tint).toBeLessThan(1);
    expect(damageLook(0.6, 4).partsOff).toBe(0);
    expect(damageLook(0.35, 4)).toMatchObject({ partsOff: 1, smoke: 'thin' });
    expect(damageLook(0.1, 4)).toMatchObject({ partsOff: 3, smoke: 'thick' });
  });

  it('nie mehr Teile als vorhanden; Totalschaden', () => {
    expect(damageLook(0.1, 1).partsOff).toBe(1);
    expect(damageLook(0, 3)).toMatchObject({ wrecked: true, partsOff: 3 });
  });

  it('Balkenfarbe wird unter 40 % rot', () => {
    expect(healthColor(0.9)).toBe('green');
    expect(healthColor(0.5)).toBe('yellow');
    expect(healthColor(0.39)).toBe('red');
  });
});
