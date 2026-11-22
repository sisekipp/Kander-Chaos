import type { ColorZones } from './recolor.ts';
import type { ModelKind } from './registry.ts';
import type { PartCut } from './split.ts';
import type { VehicleDims } from './vehicleDims.ts';

/** Fahrzeugangaben im Rezept; Box und Räder berechnet der Build aus dem skalierten Modell. */
export interface VehicleRecipe {
  /** VehicleKind des Spiels: 0 Auto, 1 Fahrrad, 2 Motorrad. */
  vehicleKind: 0 | 1 | 2;
  /** Fahrzeugtyp für Anzeige und Auswahl (z. B. Kleinwagen, Kombi). */
  type: string;
  /** Knotennamen der Räder (vorne links, vorne rechts, hinten links, hinten rechts bzw. vorne, hinten). */
  wheels: string[];
  /** Knoten, an dem die Figur sitzt (Zweiräder). */
  seat?: string;
}

/** Rezept `assets/recipes/<id>.json`: was aus einer Quelldatei wird. */
export interface Recipe {
  id: string;
  kind: ModelKind;
  /** Quelldatei relativ zu `assets/sources/` bzw. `assets/` (eigene Modelle, Wahrzeichen). */
  source: string;
  /** Skalierung, gleichmäßig oder je Achse [x, y, z] (Quelle in Metern = 1). */
  scale?: number | [number, number, number];
  colorZones?: ColorZones;
  /** Paletten-Textur in Vertex-Farben einbacken; `paintNode` = Knoten mit der Lackfarbe. */
  texture?: { paintNode: string | null };
  /** Bereiche, die als lösbare Teile (`detach_*`) abgetrennt werden (Koordinaten der Quelle). */
  parts?: PartCut[];
  vehicle?: VehicleRecipe;
}

/** Eintrag im Manifest `apps/game/public/models/manifest.json` (liest das Spiel). */
export interface ManifestEntry {
  id: string;
  kind: ModelKind;
  file: string;
  bytes: number;
  triangles: number;
  zones: string[];
  parts: string[];
  vehicle?: Omit<VehicleRecipe, 'wheels'> & VehicleDims;
}

export function parseRecipe(json: unknown, file: string): Recipe {
  const r = json as Recipe;
  const missing = (['id', 'kind', 'source'] as const).filter((k) => !r?.[k]);
  if (missing.length) throw new Error(`${file}: Pflichtfelder fehlen: ${missing.join(', ')}`);
  if (r.kind === 'vehicle' && !r.vehicle) throw new Error(`${file}: Fahrzeug ohne Maße (vehicle)`);
  return r;
}
