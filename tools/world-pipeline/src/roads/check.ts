import { BuildingType, type TileData } from '@kandern/world-format';

/** Höchstanteil der Kreuzungen im Rückfallmodus (Kreisscheibe). */
export const MAX_FALLBACK_SHARE = 0.15;
/** Größter erlaubter Höhensprung zwischen aneinanderstoßenden Brückenteilstücken (m). */
export const MAX_DECK_JUMP = 0.05;
/** Suchradius um den Ortsmittelpunkt für „Kirche Kandern hat Turm“ (m). */
const CHURCH_RADIUS = 500;

export interface DetailCheck {
  ok: boolean;
  messages: string[];
}

/** Prüft Abschnitt 7: Rückfallquote der Kreuzungen, nahtlose Brücken, Kirchturm in Kandern. */
export function checkDetails(tiles: TileData[], kandern: { x: number; z: number } | undefined): DetailCheck {
  const messages: string[] = [];
  let ok = true;
  const pass = (m: string) => messages.push(`✔ ${m}`);
  const fail = (m: string) => {
    messages.push(`✘ ${m}`);
    ok = false;
  };

  // 1. Kreuzungen im Rückfallmodus
  let junctions = 0,
    fallback = 0;
  for (const t of tiles)
    for (const j of t.details?.junctions ?? []) {
      junctions++;
      if (j.fallback) fallback++;
    }
  const share = junctions ? fallback / junctions : 0;
  const pct = (share * 100).toFixed(1);
  if (junctions === 0) fail('keine Kreuzungspolygone in den Kacheldaten');
  else if (share < MAX_FALLBACK_SHARE) pass(`${junctions} Kreuzungen, davon ${pct} % im Rückfallmodus (< 15 %)`);
  else fail(`${pct} % der Kreuzungen im Rückfallmodus (≥ 15 %)`);

  // 2. Brücken ohne Höhensprung: Enden von Brückenteilstücken an derselben Weltposition vergleichen
  const ends = new Map<string, number[]>();
  let parts = 0;
  for (const t of tiles) {
    const x0 = t.tx * t.size,
      z0 = t.tz * t.size;
    t.roads.forEach((r, i) => {
      const d = t.details?.roads[i];
      if (!d || Number.isNaN(d.deckStart)) return;
      parts++;
      const n = r.points.length;
      for (const [x, z, h] of [
        [r.points[0], r.points[1], d.deckStart],
        [r.points[n - 2], r.points[n - 1], d.deckEnd],
      ]) {
        const key = `${Math.round((x + x0) * 20)},${Math.round((z + z0) * 20)}`;
        let l = ends.get(key);
        if (!l) ends.set(key, (l = []));
        l.push(h);
      }
    });
  }
  let worst = 0;
  for (const hs of ends.values()) if (hs.length > 1) worst = Math.max(worst, Math.max(...hs) - Math.min(...hs));
  if (worst <= MAX_DECK_JUMP) pass(`${parts} Brückenteilstücke, größter Höhensprung ${worst.toFixed(3)} m`);
  else fail(`Brücken: Höhensprung ${worst.toFixed(2)} m > ${MAX_DECK_JUMP} m`);

  // 3. Kirche in Kandern hat einen Turm
  if (!kandern) fail('Ort Kandern nicht gefunden (Kirchturm-Prüfung)');
  else {
    let found = false;
    for (const t of tiles) {
      const x0 = t.tx * t.size,
        z0 = t.tz * t.size;
      const churches = new Set(t.buildings.filter((b) => b.type === BuildingType.Church).map((b) => b.id));
      for (const tw of t.details?.churchTowers ?? [])
        if (churches.has(tw.buildingId) && Math.hypot(tw.x + x0 - kandern.x, tw.z + z0 - kandern.z) < CHURCH_RADIUS)
          found = true;
    }
    if (found) pass('Kirche in Kandern hat einen Turm');
    else fail('keine Kirche mit Turm im Umkreis von 500 m um Kandern');
  }
  return { ok, messages };
}
