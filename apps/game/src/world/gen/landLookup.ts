import { LandKind, pointInRing, type LandArea } from '@kandern/world-format';

/** Priorität beim Überlappen: höhere gewinnt (Wasser über Wald über Wiese ...). */
const PRIORITY: Record<LandKind, number> = {
  [LandKind.Farmland]: 1,
  [LandKind.Meadow]: 2,
  [LandKind.Vineyard]: 3,
  [LandKind.Orchard]: 3,
  [LandKind.Residential]: 4,
  [LandKind.Commercial]: 5,
  [LandKind.Industrial]: 5,
  [LandKind.ForestMixed]: 6,
  [LandKind.ForestDeciduous]: 6,
  [LandKind.ForestConiferous]: 6,
  [LandKind.Cemetery]: 7,
  [LandKind.Park]: 7,
  [LandKind.Sports]: 7,
  [LandKind.Water]: 9,
  [LandKind.Apron]: 10,
  [LandKind.Platform]: 10,
  [LandKind.Taxiway]: 11,
  [LandKind.Runway]: 12,
};

interface Prepared {
  kind: LandKind;
  prio: number;
  rings: Float32Array[];
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

/** Schnelle Abfrage "welche Landnutzung liegt an (x, z)?" für eine Kachel. */
export class LandLookup {
  private readonly areas: Prepared[];

  constructor(land: LandArea[]) {
    this.areas = land
      .map((a) => {
        const o = a.rings[0];
        let minX = Infinity,
          minZ = Infinity,
          maxX = -Infinity,
          maxZ = -Infinity;
        for (let i = 0; i < o.length; i += 2) {
          minX = Math.min(minX, o[i]);
          maxX = Math.max(maxX, o[i]);
          minZ = Math.min(minZ, o[i + 1]);
          maxZ = Math.max(maxZ, o[i + 1]);
        }
        return { kind: a.kind, prio: PRIORITY[a.kind] ?? 0, rings: a.rings, minX, minZ, maxX, maxZ };
      })
      .sort((a, b) => b.prio - a.prio);
  }

  kindAt(x: number, z: number): LandKind | null {
    const i = this.areaAt(x, z);
    return i < 0 ? null : this.areas[i].kind;
  }

  /** Index der obersten Fläche an (x, z) oder −1 (stabil je Kachel, für Flächen-Identität). */
  areaAt(x: number, z: number): number {
    for (let ai = 0; ai < this.areas.length; ai++) {
      const a = this.areas[ai];
      if (x < a.minX || x > a.maxX || z < a.minZ || z > a.maxZ) continue;
      if (!pointInRing(x, z, a.rings[0])) continue;
      let inHole = false;
      for (let k = 1; k < a.rings.length; k++)
        if (pointInRing(x, z, a.rings[k])) {
          inHole = true;
          break;
        }
      if (!inHole) return ai;
    }
    return -1;
  }

  kindOf(area: number): LandKind {
    return this.areas[area].kind;
  }

  /** Außenring einer Fläche (Kachel-lokal). */
  outerRing(area: number): Float32Array {
    return this.areas[area].rings[0];
  }
}
