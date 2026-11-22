/** Spielstand: rein lokal, JSON mit Schema-Version (Migrationen über `schemaVersion`). */
export const SAVE_SCHEMA_VERSION = 1;
export const SAVE_KIND = 'kandern-chaos-spielstand';

export interface SaveGame {
  kind: typeof SAVE_KIND;
  schemaVersion: number;
  savedAt: string;
  /** Datenstand der Welt beim Speichern (nur Info). */
  worldVersion: string;
  player: { x: number; z: number; yaw: number };
  settings: { quality: 'low' | 'high' };
  /** Platz für spätere Changes (Fortschritt, Belohnungen …). */
  progress: Record<string, unknown>;
}

export class SaveValidationError extends Error {}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Prüft und migriert einen unbekannten Wert zu einem gültigen Spielstand oder wirft eine verständliche Fehlermeldung. */
export function parseSave(raw: unknown): SaveGame {
  if (typeof raw !== 'object' || raw === null) throw new SaveValidationError('Die Datei enthält keinen Spielstand.');
  const o = raw as Record<string, unknown>;
  if (o.kind !== SAVE_KIND) throw new SaveValidationError('Das ist kein Kandern-Chaos-Spielstand.');
  if (!isNum(o.schemaVersion)) throw new SaveValidationError('Der Spielstand hat keine gültige Version.');
  if (o.schemaVersion > SAVE_SCHEMA_VERSION)
    throw new SaveValidationError(
      'Der Spielstand stammt aus einer neueren Spielversion. Bitte zuerst das Spiel aktualisieren.',
    );
  const p = o.player as Record<string, unknown> | undefined;
  if (!p || !isNum(p.x) || !isNum(p.z))
    throw new SaveValidationError('Der Spielstand ist beschädigt (Position fehlt).');
  if (Math.abs(p.x) > 50_000 || Math.abs(p.z) > 50_000)
    throw new SaveValidationError('Der Spielstand ist beschädigt (Position außerhalb der Welt).');
  const s = (o.settings ?? {}) as Record<string, unknown>;
  return {
    kind: SAVE_KIND,
    schemaVersion: SAVE_SCHEMA_VERSION,
    savedAt: typeof o.savedAt === 'string' ? o.savedAt : new Date(0).toISOString(),
    worldVersion: typeof o.worldVersion === 'string' ? o.worldVersion : '',
    player: { x: p.x, z: p.z, yaw: isNum(p.yaw) ? p.yaw : 0 },
    settings: { quality: s.quality === 'high' ? 'high' : 'low' },
    progress: typeof o.progress === 'object' && o.progress !== null ? (o.progress as Record<string, unknown>) : {},
  };
}

/** Liest eine Export-Datei (Text) – wirft SaveValidationError bei kaputtem JSON oder falschem Inhalt. */
export function parseSaveFile(text: string): SaveGame {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SaveValidationError('Die Datei ist beschädigt oder kein Spielstand (kein gültiges JSON).');
  }
  return parseSave(raw);
}

export function newSave(
  player: SaveGame['player'],
  quality: 'low' | 'high',
  worldVersion: string,
  progress: Record<string, unknown> = {},
): SaveGame {
  return {
    kind: SAVE_KIND,
    schemaVersion: SAVE_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    worldVersion,
    player,
    settings: { quality },
    progress,
  };
}
