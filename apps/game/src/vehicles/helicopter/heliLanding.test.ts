import { describe, expect, it } from 'vite-plus/test';
import { canExit, canLandAt, exitPoints } from './heliLanding.ts';

const flat = () => 100;
const none = () => null;

describe('Hubschrauber-Landeregeln', () => {
  it('ebene Wiese: Landen erlaubt', () => {
    expect(canLandAt(0, 0, flat, none)).toBe(true);
  });

  it('steiler Hang (30 %, ca. 17°): kein Aufsetzen; flacher Hang (10 %) geht', () => {
    expect(canLandAt(0, 0, (x) => 100 + x * 0.3, none)).toBe(false);
    expect(canLandAt(0, 0, (x) => 100 + x * 0.1, none)).toBe(true);
  });

  it('Dach über dem Gelände: kein Aufsetzen', () => {
    expect(canLandAt(0, 0, flat, () => 109)).toBe(false);
    expect(canLandAt(0, 0, flat, () => 100.2)).toBe(true);
  });

  it('Aussteigen nur bis 1 m über dem Boden', () => {
    expect(canExit(100.5, 100)).toBe(true);
    expect(canExit(120, 100)).toBe(false);
  });

  it('Ausstieg rechts und links neben der Kabine', () => {
    const [r, l] = exitPoints(0, 0, 0);
    expect(r[0]).toBeCloseTo(2.6);
    expect(l[0]).toBeCloseTo(-2.6);
    expect(r[1]).toBeCloseTo(0);
  });
});
