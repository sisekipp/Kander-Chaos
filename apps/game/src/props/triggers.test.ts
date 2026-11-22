import { describe, expect, it } from 'vite-plus/test';
import { PropKind } from '@kandern/world-format';
import { PROP_RULES, launchVelocity, triggers } from './triggers.ts';

describe('Auslöse-Regeln', () => {
  it('Mülleimer fliegt bei 30 km/h, Busch zerbricht beim Fahrrad (20 km/h)', () => {
    expect(triggers(PropKind.Bin, 30)).toBe(true);
    expect(PROP_RULES[PropKind.Bin].reaction).toBe('fly');
    expect(triggers(PropKind.Bush, 20)).toBe(true);
    expect(PROP_RULES[PropKind.Bush].reaction).toBe('shatter');
  });

  it('zu Fuß (18 km/h) bleibt die Laterne stehen und blockiert', () => {
    expect(triggers(PropKind.Lamp, 18)).toBe(false);
    expect(PROP_RULES[PropKind.Lamp].blocksWalker).toBe(true);
    expect(PROP_RULES[PropKind.Lamp].reaction).toBe('topple');
  });

  it('Trümmerzahl 3–8 bei zerbrechenden Objekten', () => {
    for (const r of Object.values(PROP_RULES)) if (r.reaction === 'shatter') expect(r.pieces).toBeGreaterThanOrEqual(3);
    for (const r of Object.values(PROP_RULES)) expect(r.pieces).toBeLessThanOrEqual(8);
  });

  it('Startimpuls folgt der Fahrtrichtung und hebt an', () => {
    const v = launchVelocity(8, 0, PropKind.Bin);
    expect(v.vx).toBeGreaterThan(8);
    expect(v.vy).toBeGreaterThan(0);
    expect(v.vz).toBe(0);
  });
});
