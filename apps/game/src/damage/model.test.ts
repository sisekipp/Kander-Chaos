import { describe, expect, it } from 'vite-plus/test';
import { DamageState, impactDamage } from './model.ts';

describe('Schadensmodell', () => {
  it('unter 10 km/h kein Schaden (leichtes Anstupsen)', () => {
    expect(impactDamage(5, 'world')).toBe(0);
    expect(impactDamage(9.9, 'vehicle')).toBe(0);
  });

  it('60 km/h frontal gegen eine Wand kostet mindestens 30 Prozentpunkte', () => {
    expect(impactDamage(60, 'world')).toBeGreaterThanOrEqual(0.3);
    expect(impactDamage(60, 'world')).toBeLessThan(0.4);
  });

  it('wächst mit dem Tempo', () => {
    expect(impactDamage(30, 'world')).toBeLessThan(impactDamage(50, 'world'));
    expect(impactDamage(200, 'world')).toBe(1);
  });

  it('10 Büsche mit 50 km/h kosten höchstens 20 Prozentpunkte', () => {
    const s = new DamageState();
    for (let i = 0; i < 10; i++) s.hit(i * 300, 50, 'prop');
    expect(s.health).toBeGreaterThanOrEqual(0.8 - 1e-9); // Gleitkomma: 10 × 2 % = 20 %
  });

  it('entprellt Mehrfachkontakte innerhalb von 150 ms', () => {
    const s = new DamageState();
    expect(s.hit(0, 60, 'world')).toBeGreaterThan(0);
    expect(s.hit(100, 60, 'world')).toBe(0);
    expect(s.hit(200, 60, 'world')).toBeGreaterThan(0);
  });

  it('Totalschaden bei 0, danach kein weiterer Schaden', () => {
    const s = new DamageState();
    for (let i = 0; i < 5; i++) s.hit(i * 1000, 80, 'world');
    expect(s.wrecked).toBe(true);
    expect(s.hit(10_000, 80, 'world')).toBe(0);
  });
});
