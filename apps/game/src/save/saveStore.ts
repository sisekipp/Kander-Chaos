import { get, set } from 'idb-keyval';
import { SaveValidationError, newSave, parseSave, parseSaveFile, type SaveGame } from './saveGame.ts';
import { downloadJson } from '../engine/perf/FrameRecorder.ts';

const KEY = 'kc.save.slot1';

/** Lädt den Spielstand aus IndexedDB (null, wenn keiner oder ungültig). */
export async function loadSave(): Promise<SaveGame | null> {
  try {
    const raw = await get(KEY);
    return raw ? parseSave(raw) : null;
  } catch (e) {
    console.warn('[save] ungültiger Spielstand ignoriert', e);
    return null;
  }
}

export async function storeSave(save: SaveGame): Promise<void> {
  await set(KEY, save);
}

/** Figurvariante in den bestehenden Spielstand schreiben (ohne Spielstand übernimmt sie das nächste Speichern). */
export async function storeFigureVariant(variant: number): Promise<void> {
  const s = await loadSave();
  if (s) await storeSave({ ...s, figure: { variant } });
}

export interface SaveSource {
  snapshot(): SaveGame | null;
}

/**
 * Automatisches Speichern: alle 30 s, beim Wechsel in den Hintergrund und beim Verlassen der Seite.
 * `pagehide`/`visibilitychange` sind auf iOS die einzig verlässlichen Signale.
 */
export function startAutosave(source: SaveSource, intervalMs = 30_000): () => void {
  const save = () => {
    const s = source.snapshot();
    if (s) void storeSave(s);
  };
  const onVis = () => {
    if (document.visibilityState === 'hidden') save();
  };
  const t = window.setInterval(save, intervalMs);
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('pagehide', save);
  return () => {
    save();
    window.clearInterval(t);
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('pagehide', save);
  };
}

export async function exportSave(): Promise<boolean> {
  const s = await loadSave();
  if (!s) return false;
  downloadJson('kandern-chaos-spielstand.json', s);
  return true;
}

/** Importiert eine Datei. Bei Fehlern bleibt der bestehende Spielstand unverändert. */
export async function importSave(file: File): Promise<SaveGame> {
  const text = await file.text();
  const parsed = parseSaveFile(text); // wirft vor jeder Änderung
  await storeSave({ ...parsed, savedAt: new Date().toISOString() });
  return parsed;
}

export { SaveValidationError, newSave };
