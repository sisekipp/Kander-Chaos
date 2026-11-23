/**
 * Prüfungen für das regionale Gebiet (Spec world-data-pipeline): Budgets für Kern, Nachladeregionen und
 * Einzelpakete, Gebäude in den Städten, Autobahn bei Weil, Pisten am EuroAirport, Hochhaus Roche in der
 * Fernsicht-Liste. Reine Funktionen; `check.ts` liest die Dateien und gibt die Meldungen aus.
 */
import { LandKind, RoadKind, type PackEntry, type TileData } from '@kandern/world-format';
import type { SkylineEntry } from './skyline.ts';

export const MB = 1048576;
export const BUDGETS = { core: 120 * MB, remote: 800 * MB, pack: 25 * MB };

export interface CheckResult {
  ok: boolean;
  messages: string[];
}

const fmt = (b: number) => `${(b / MB).toFixed(1)} MB`;

/** Größenbudgets: Kern ≤ 120 MB, Nachladeregionen ≤ 800 MB, jedes Paket ≤ 25 MB. */
export function checkBudgets(packs: PackEntry[], budgets = BUDGETS): CheckResult {
  const core = packs.filter((p) => !p.remote).reduce((s, p) => s + p.bytes, 0);
  const remote = packs.filter((p) => p.remote).reduce((s, p) => s + p.bytes, 0);
  const big = packs.filter((p) => p.bytes > budgets.pack);
  const messages = [
    `${core <= budgets.core ? '✔' : '✘'} Kern ${fmt(core)} ≤ ${fmt(budgets.core)}`,
    `${remote <= budgets.remote ? '✔' : '✘'} Nachladeregionen ${fmt(remote)} ≤ ${fmt(budgets.remote)}`,
    big.length
      ? `✘ ${big.length} Pakete über ${fmt(budgets.pack)}: ${big.map((p) => p.file).join(', ')}`
      : `✔ alle Pakete ≤ ${fmt(budgets.pack)}`,
  ];
  return { ok: core <= budgets.core && remote <= budgets.remote && !big.length, messages };
}

/** Zählt in allen Kacheln, deren Mitte höchstens `radius` m von (x, z) entfernt ist. */
function near(tiles: TileData[], x: number, z: number, radius: number, count: (t: TileData) => number): number {
  let n = 0;
  for (const t of tiles) {
    const cx = (t.tx + 0.5) * t.size,
      cz = (t.tz + 0.5) * t.size;
    if (Math.hypot(cx - x, cz - z) <= radius) n += count(t);
  }
  return n;
}

export interface RegionTargets {
  /** Städte, die Gebäude haben müssen (Weltlage). */
  towns: { name: string; x: number; z: number }[];
  weil: { x: number; z: number };
  airport: { x: number; z: number };
  roche: { x: number; z: number };
}

export function checkRegion(tiles: TileData[], skyline: SkylineEntry[], t: RegionTargets): CheckResult {
  const messages: string[] = [];
  let ok = true;
  const check = (pass: boolean, msg: string) => {
    messages.push(`${pass ? '✔' : '✘'} ${msg}`);
    ok &&= pass;
  };
  for (const town of t.towns) {
    const n = near(tiles, town.x, town.z, 600, (k) => k.buildings.length);
    check(n >= 50, `${town.name}: ${n} Gebäude im Umkreis von 600 m`);
  }
  const a5 = near(tiles, t.weil.x, t.weil.z, 3000, (k) => k.roads.filter((r) => r.kind === RoadKind.Motorway).length);
  check(a5 > 0, `Autobahn bei Weil am Rhein: ${a5} Teilstücke im Umkreis von 3 km`);
  const runway = near(
    tiles,
    t.airport.x,
    t.airport.z,
    3000,
    (k) => k.land.filter((l) => l.kind === LandKind.Runway).length,
  );
  check(runway > 0, `Pisten EuroAirport: ${runway} Flächen im Umkreis von 3 km`);
  const tall = skyline.find((e) => Math.hypot(e.x - t.roche.x, e.z - t.roche.z) < 300 && e.h > 150);
  check(!!tall, `Roche-Turm > 150 m in der Fernsicht-Liste${tall ? ` (${tall.h} m)` : ''}`);
  return { ok, messages };
}
