import { LandKind, pointInRing, type TileData } from '@kandern/world-format';

/** Landnutzung an einem Kachel-lokalen Punkt (höchste Priorität gewinnt: Siedlung vor Grün). */
export function landAt(t: TileData, lx: number, lz: number): LandKind | null {
  let found: LandKind | null = null;
  for (const a of t.land) {
    if (!pointInRing(lx, lz, a.rings[0])) continue;
    let hole = false;
    for (let k = 1; k < a.rings.length; k++) if (pointInRing(lx, lz, a.rings[k])) hole = true;
    if (hole) continue;
    if (a.kind === LandKind.Residential || a.kind === LandKind.Commercial) return a.kind;
    found = a.kind;
  }
  return found;
}

/** Bebautes Umfeld: Wohn-/Gewerbefläche oder ein Gebäude im Umkreis von `r` Metern. */
export function isSettled(t: TileData, lx: number, lz: number, r = 35): boolean {
  const k = landAt(t, lx, lz);
  if (k === LandKind.Residential || k === LandKind.Commercial) return true;
  for (const b of t.buildings) {
    const o = b.outline;
    if (Math.hypot(o[0] - lx, o[1] - lz) < r) return true;
  }
  return false;
}
