import { describe, expect, it } from 'vite-plus/test';
import { checkModels, passesStyle, validateRegistry, type Registry, type RegistryEntry } from './registry.ts';

const entry = (o: Partial<RegistryEntry> = {}): RegistryEntry => ({
  id: 'car-compact',
  kind: 'vehicle',
  source: 'https://example.org/paket',
  package: 'Beispielpaket',
  license: 'CC0-1.0',
  retrieved: '2026-11-22',
  style: { european: true, noLogos: true },
  changes: 'umgefärbt',
  status: 'accepted',
  ...o,
});
const reg = (...entries: RegistryEntry[]): Registry => ({ version: 1, entries });

describe('Lizenzregister', () => {
  it('Build schlägt bei Modell ohne Registereintrag fehl (mit Name des Modells)', () => {
    const errors = checkModels(['car-compact', 'bin-new'], reg(entry()));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('"bin-new"');
  });

  it('gültiges Register ohne Fehler', () => {
    expect(validateRegistry(reg(entry()))).toEqual([]);
    expect(checkModels(['car-compact'], reg(entry()))).toEqual([]);
  });

  it('Pflichtfelder: Quelle, Paket, zulässige Lizenz, Abrufdatum, Änderungen', () => {
    const bad = entry({
      source: '',
      package: '',
      license: 'CC-BY-NC' as never,
      retrieved: '22.11.2026',
      changes: undefined as never,
    });
    const errors = validateRegistry(reg(bad));
    expect(errors.some((e) => e.includes('Quelle'))).toBe(true);
    expect(errors.some((e) => e.includes('Paket'))).toBe(true);
    expect(errors.some((e) => e.includes('Lizenz'))).toBe(true);
    expect(errors.some((e) => e.includes('Abrufdatum'))).toBe(true);
    expect(errors.some((e) => e.includes('Änderungen'))).toBe(true);
  });

  it('doppelte IDs werden erkannt', () => {
    expect(validateRegistry(reg(entry(), entry()))[0]).toContain('doppelt');
  });

  it('Stilprüfung: US-Fahrzeug oder Logo fällt durch, Schilder brauchen StVO-Form', () => {
    expect(passesStyle(entry({ style: { european: false, noLogos: true } }))).toBe(false);
    expect(passesStyle(entry({ style: { european: true, noLogos: false } }))).toBe(false);
    expect(passesStyle(entry({ kind: 'prop', style: { european: true, noLogos: true, stvo: false } }))).toBe(false);
    expect(checkModels(['car-compact'], reg(entry({ style: { european: false, noLogos: true } })))[0]).toContain(
      'Stilprüfung',
    );
  });

  it('vorgemerkte oder verworfene Modelle dürfen nicht in den Build', () => {
    expect(checkModels(['car-compact'], reg(entry({ status: 'planned' })))[0]).toContain('nicht angenommen');
  });
});
