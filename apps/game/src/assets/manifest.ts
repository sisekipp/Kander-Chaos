/** Modell-Manifest (`public/models/manifest.json`), erzeugt von `tools/asset-pipeline`. */

export type ModelKind = 'vehicle' | 'prop' | 'figure' | 'npc' | 'landmark';

export interface WheelInfo {
  name: string;
  x: number;
  y: number;
  z: number;
  radius: number;
}

export interface VehicleInfo {
  /** VehicleKind: 0 Auto, 1 Fahrrad, 2 Motorrad. */
  vehicleKind: 0 | 1 | 2;
  type: string;
  box: [number, number, number];
  center: [number, number, number];
  wheels: WheelInfo[];
  seat?: string;
}

export interface ModelEntry {
  id: string;
  kind: ModelKind;
  file: string;
  bytes: number;
  triangles: number;
  /** Farbzonen (z. B. „paint“), Materialname im Modell: `zone_<name>`. */
  zones: string[];
  /** Knoten der lösbaren Teile (`detach_*`). */
  parts: string[];
  vehicle?: VehicleInfo;
}

export interface ModelManifest {
  version: number;
  models: ModelEntry[];
}

const KINDS: ModelKind[] = ['vehicle', 'prop', 'figure', 'npc', 'landmark'];

/** Prüft und liest das Manifest; wirft bei unbekannter Version oder fehlenden Pflichtfeldern. */
export function parseManifest(json: unknown): ModelManifest {
  const m = json as ModelManifest;
  if (!m || m.version !== 1 || !Array.isArray(m.models)) throw new Error('Modell-Manifest: unbekanntes Format');
  for (const e of m.models) {
    if (!e.id || !e.file || !KINDS.includes(e.kind))
      throw new Error(`Modell-Manifest: ungültiger Eintrag ${JSON.stringify(e).slice(0, 80)}`);
    if (e.kind === 'vehicle' && (!e.vehicle || e.vehicle.wheels.length < 2))
      throw new Error(`Modell-Manifest: Fahrzeug ${e.id} ohne Räder`);
    e.zones ??= [];
    e.parts ??= [];
  }
  // stabile Reihenfolge (deterministische Auswahl je ID)
  m.models.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return m;
}

/** Fahrzeugmodelle einer VehicleKind (z. B. alle Autos). */
export function vehicleModels(m: ModelManifest, vehicleKind: number): ModelEntry[] {
  return m.models.filter((e) => e.kind === 'vehicle' && e.vehicle!.vehicleKind === vehicleKind);
}

export function modelsOfKind(m: ModelManifest, kind: ModelKind): ModelEntry[] {
  return m.models.filter((e) => e.kind === kind);
}
