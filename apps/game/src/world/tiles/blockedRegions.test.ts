import { describe, expect, it } from 'vite-plus/test';
import { applyBorder, borderPush, lookAheadTiles } from './blockedRegions.ts';

describe('lookAheadTiles', () => {
  it('folgt dem Weg der nächsten Sekunden', () => {
    const ids = lookAheadTiles(125, 125, 50, 0, { seconds: 20, radius: 0, tileSize: 250 });
    expect(ids).toContain('4,0');
    expect(ids).not.toContain('0,1');
    expect(ids.length).toBe(4);
  });
  it('steht still -> nichts vorladen', () => {
    expect(lookAheadTiles(0, 0, 0.2, 0, { seconds: 20, radius: 250, tileSize: 250 })).toEqual([]);
  });
});

describe('borderPush / applyBorder', () => {
  const blockedEast = (tx: number) => tx >= 1; // ab x = 250 gesperrt
  it('frei -> kein Schub', () => {
    expect(borderPush(100, 100, blockedEast, 250)).toBeNull();
  });
  it('vor der Sperre: Schub nach Westen, stärker je näher', () => {
    const a = borderPush(230, 100, blockedEast, 250)!;
    const b = borderPush(200, 100, blockedEast, 250)!;
    expect(a.nx).toBeCloseTo(-1);
    expect(a.strength).toBeGreaterThan(b.strength);
  });
  it('Bewegung auf die Sperre zu wird gebremst und umgekehrt', () => {
    const v = applyBorder(20, 0, borderPush(245, 100, blockedEast, 250));
    expect(v.vx).toBeLessThan(0);
    const away = applyBorder(-5, 3, borderPush(245, 100, blockedEast, 250));
    expect(away.vx).toBeLessThan(-5);
    expect(away.vz).toBe(3);
  });
});
