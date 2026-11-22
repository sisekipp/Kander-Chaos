import {
  BuildingType,
  centroid,
  orientedRect,
  pointInRing,
  type Building,
  type ChurchTower,
} from '@kandern/world-format';

/** Kürzere Kirchen (z. B. Kapellen) bekommen keinen Turm (m, Länge der langen Seite). */
const MIN_CHURCH_LENGTH = 12;
const MIN_TOWER = 4;
const MAX_TOWER = 8;

/** Turm aus einem Gebäudeteil-Grundriss (quadratisch: längere Seite des umschließenden Rechtecks). */
function towerFromPart(id: number, part: number[]): ChurchTower {
  const r = orientedRect(part);
  return {
    buildingId: id,
    x: r.cx,
    z: r.cz,
    size: Math.min(MAX_TOWER * 1.5, Math.max(MIN_TOWER, 2 * r.halfLong)),
    rot: Math.atan2(r.uz, r.ux),
  };
}

/**
 * Lage des Kirchturms. Vorrang hat ein Gebäudeteil (Turm), dessen Mitte im Kirchengrundriss liegt.
 * Sonst gilt die Regel: Turm an der westlichen Schmalseite (Altar im Osten), innerhalb des Grundrisses.
 * Gibt null zurück für Nicht-Kirchen und sehr kleine Kapellen.
 */
export function churchTower(b: Building, towerParts: number[][]): ChurchTower | null {
  if (b.type !== BuildingType.Church) return null;
  for (const part of towerParts) {
    const [cx, cz] = centroid(part);
    if (pointInRing(cx, cz, b.outline)) return towerFromPart(b.id, part);
  }
  const r = orientedRect(b.outline);
  if (2 * r.halfLong < MIN_CHURCH_LENGTH) return null;
  const size = Math.min(MAX_TOWER, Math.max(MIN_TOWER, 2 * r.halfShort * 0.6));
  // Westliches Ende der langen Achse
  const sign = r.ux > 0 || (r.ux === 0 && r.uz < 0) ? -1 : 1;
  const d = sign * (r.halfLong - size / 2);
  return { buildingId: b.id, x: r.cx + r.ux * d, z: r.cz + r.uz * d, size, rot: Math.atan2(r.uz, r.ux) };
}

/** Kirchtürme aller Gebäude einer Kachel (Gebäudeteile in Kachel-lokalen Koordinaten). */
export function churchTowers(buildings: Building[], towerParts: number[][]): ChurchTower[] {
  const out: ChurchTower[] = [];
  for (const b of buildings) {
    const t = churchTower(b, towerParts);
    if (t) out.push(t);
  }
  return out;
}

/** Gebäudeteil-Tags, die einen Turm beschreiben. */
export function isTowerPart(tags: Record<string, string>): boolean {
  const p = tags['building:part'];
  return (
    p === 'tower' ||
    p === 'steeple' ||
    p === 'bell_tower' ||
    (tags.man_made === 'tower' && tags['tower:type'] === 'bell_tower')
  );
}
