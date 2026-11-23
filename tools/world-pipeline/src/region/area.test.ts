import { describe, expect, it } from 'vite-plus/test';
import type { StudyArea } from '../area.ts';
import { projectToWorld } from '../area.ts';
import { isCorePack, isRemotePack, PLAY_AREA, regionalArea, worldRect } from './area.ts';

/** Kern: Quadrat −1000 … 1000 m um den Ursprung. */
const core: StudyArea = {
  boundary: [],
  minX: -1000,
  minZ: -1000,
  maxX: 1000,
  maxZ: 1000,
  includesTile: (tx, tz) => tx >= -4 && tx < 4 && tz >= -4 && tz < 4,
};

describe('regionales Spielgebiet', () => {
  const rect = worldRect(PLAY_AREA, projectToWorld);
  const area = regionalArea(core, rect, 250);
  const tileOf = (lat: number, lon: number) => {
    const [x, z] = projectToWorld({ lat, lon });
    return { tx: Math.floor(x / 250), tz: Math.floor(z / 250) };
  };

  it('umfasst Müllheim, Lörrach, Weil am Rhein, Basel Marktplatz und den EuroAirport', () => {
    for (const [name, lat, lon] of [
      ['Müllheim', 47.808, 7.63],
      ['Lörrach', 47.614, 7.664],
      ['Weil am Rhein', 47.594, 7.621],
      ['Basel Marktplatz', 47.558, 7.588],
      ['EuroAirport', 47.59, 7.529],
    ] as const) {
      const t = tileOf(lat, lon);
      expect(area.includesTile(t.tx, t.tz), name).toBe(true);
      expect(area.isCoreTile(t.tx, t.tz), name).toBe(false);
    }
  });

  it('Rechteck ist ca. 18 × 33 km groß', () => {
    expect(rect.maxX - rect.minX).toBeGreaterThan(16000);
    expect(rect.maxX - rect.minX).toBeLessThan(20000);
    expect(rect.maxZ - rect.minZ).toBeGreaterThan(32000);
    expect(rect.maxZ - rect.minZ).toBeLessThan(35000);
  });

  it('Kern bleibt Kern, Kacheln außerhalb gehören nicht dazu', () => {
    expect(area.isCoreTile(0, 0)).toBe(true);
    const far = tileOf(47.9, 7.9);
    expect(area.includesTile(far.tx, far.tz)).toBe(false);
  });

  it('ein Paket ist Kern, sobald eine Kachel zum Kern gehört', () => {
    expect(
      isCorePack(
        [
          { tx: 3, tz: 3 },
          { tx: 4, tz: 4 },
        ],
        area,
      ),
    ).toBe(true);
    expect(isCorePack([{ tx: 40, tz: 40 }], area)).toBe(false);
  });

  it('Nachladepakete gibt es nur im regionalen Gebiet', () => {
    expect(isRemotePack([{ tx: 40, tz: 40 }], area)).toBe(true);
    expect(isRemotePack([{ tx: 0, tz: 0 }], area)).toBe(false);
    const coreOnly = { includesTile: () => true };
    expect(isRemotePack([{ tx: 40, tz: 40 }], coreOnly)).toBe(false);
  });
});
