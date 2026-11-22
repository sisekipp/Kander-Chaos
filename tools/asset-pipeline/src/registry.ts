/**
 * Lizenzregister der 3D-Modelle (`assets/registry.json`). Spec asset-pipeline: Jedes Modell braucht einen
 * Eintrag mit Quelle, Paket, Lizenz, Abrufdatum, Stilprüfung und Änderungen; ohne Eintrag bricht der Build ab.
 */

/** Zulässige Lizenzen: CC0 (Fremdpakete) und eigene Modelle (z. B. in Blender gebaut). */
export const ALLOWED_LICENSES = ['CC0-1.0', 'own'] as const;
export type License = (typeof ALLOWED_LICENSES)[number];

export type ModelKind = 'vehicle' | 'prop' | 'figure' | 'npc' | 'landmark';

/** Stilprüfung (Spec „Regional passender Stil“). */
export interface StyleCheck {
  /** Europäische Form (kein Pickup, Schulbus, US-Polizei/-Taxi). */
  european: boolean;
  /** Keine echten Markenlogos oder -schriftzüge. */
  noLogos: boolean;
  /** Verkehrsschilder in StVO-Form und -Farbe (nur bei Schildern relevant). */
  stvo?: boolean;
  notes?: string;
}

export interface RegistryEntry {
  /** Modell-ID wie im Rezept (`assets/recipes/<id>.json`). */
  id: string;
  kind: ModelKind;
  /** Quelle: URL der Paketseite bzw. „eigenes Modell“. */
  source: string;
  package: string;
  license: License;
  /** Abrufdatum JJJJ-MM-TT. */
  retrieved: string;
  style: StyleCheck;
  /** Was gegenüber der Quelle geändert wurde (Auswahl, Umfärben, Teile umbenannt …). */
  changes: string;
  /** accepted = im Spiel; planned = vorgemerkt (z. B. selbst zu bauen); rejected = geprüft, verworfen. */
  status: 'accepted' | 'planned' | 'rejected';
}

export interface Registry {
  version: number;
  entries: RegistryEntry[];
}

const KINDS: ModelKind[] = ['vehicle', 'prop', 'figure', 'npc', 'landmark'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Prüft die Pflichtfelder aller Einträge; liefert Fehlermeldungen (leer = gültig). */
export function validateRegistry(r: Registry): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  r.entries.forEach((e, i) => {
    const at = `Eintrag ${i + 1} (${e.id || 'ohne id'})`;
    if (!e.id) errors.push(`${at}: id fehlt`);
    else if (seen.has(e.id)) errors.push(`${at}: id doppelt`);
    seen.add(e.id);
    if (!KINDS.includes(e.kind)) errors.push(`${at}: unbekannte Art "${e.kind}"`);
    if (!e.source) errors.push(`${at}: Quelle fehlt`);
    if (!e.package) errors.push(`${at}: Paket fehlt`);
    if (!ALLOWED_LICENSES.includes(e.license)) errors.push(`${at}: Lizenz "${e.license}" nicht zulässig`);
    if (!DATE.test(e.retrieved ?? '')) errors.push(`${at}: Abrufdatum fehlt oder nicht JJJJ-MM-TT`);
    if (!e.style) errors.push(`${at}: Stilprüfung fehlt`);
    if (e.changes === undefined) errors.push(`${at}: Änderungen fehlen (leer = "keine")`);
  });
  return errors;
}

/** Stilprüfung bestanden? Fahrzeuge und Gegenstände müssen europäisch und logofrei sein, Schilder StVO. */
export function passesStyle(e: RegistryEntry): boolean {
  if (e.kind === 'vehicle' || e.kind === 'prop') {
    if (!e.style.european || !e.style.noLogos) return false;
    if (e.style.stvo === false) return false;
  }
  return e.style.noLogos;
}

/**
 * Prüft die Modelle eines Builds gegen das Register: jedes braucht einen angenommenen Eintrag mit
 * bestandener Stilprüfung. Liefert Fehlermeldungen je Modell (leer = alles in Ordnung).
 */
export function checkModels(modelIds: string[], r: Registry): string[] {
  const byId = new Map(r.entries.map((e) => [e.id, e]));
  const errors: string[] = [];
  for (const id of [...modelIds].sort()) {
    const e = byId.get(id);
    if (!e) errors.push(`Modell "${id}" hat keinen Eintrag im Lizenzregister (assets/registry.json)`);
    else if (e.status !== 'accepted')
      errors.push(`Modell "${id}" ist im Register nicht angenommen (Status ${e.status})`);
    else if (!passesStyle(e)) errors.push(`Modell "${id}" hat die Stilprüfung nicht bestanden`);
  }
  return errors;
}
