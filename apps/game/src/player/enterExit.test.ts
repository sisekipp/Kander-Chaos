import { describe, expect, it } from 'vite-plus/test';
import { chooseExit, exitCandidates } from './enterExit.ts';

describe('Aussteigen', () => {
  it('Kandidaten links, rechts, hinten, vorne außerhalb der Karosserie', () => {
    const c = exitCandidates(0, 0, 0, 0.9, 2);
    expect(c.map((p) => p.side)).toEqual(['links', 'rechts', 'hinten', 'vorne']);
    expect(c[0].x).toBeCloseTo(-1.8);
    expect(c[1].x).toBeCloseTo(1.8);
    expect(c[2].z).toBeCloseTo(-2.9);
    expect(c[3].z).toBeCloseTo(2.9);
  });

  it('Kandidaten drehen mit dem Fahrzeug', () => {
    const c = exitCandidates(10, 10, Math.PI / 2, 1, 2); // Blick nach Osten
    expect(c[0].z).toBeCloseTo(11.9); // links = Norden
    expect(c[2].x).toBeCloseTo(7.1); // hinten = Westen
  });

  it('Wand auf der Fahrerseite -> Absetzen rechts', () => {
    const c = exitCandidates(0, 0, 0, 0.9, 2);
    const wallLeft = (p: { x: number }) => p.x > -1; // links (x < -1) blockiert
    expect(chooseExit(c, wallLeft)?.side).toBe('rechts');
    expect(chooseExit(c, () => false)).toBeNull();
  });
});
