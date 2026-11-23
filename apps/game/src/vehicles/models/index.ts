import type { Scene } from '@babylonjs/core/scene';
import { VehicleKind, type GroundVehicleKind } from '@kandern/world-format';
import { VEHICLE_SPECS } from '../specs.ts';
import { buildCar } from './car.ts';
import { buildTwoWheeler } from './twoWheeler.ts';
import { paintFor } from './palette.ts';
import type { VehicleModel } from './types.ts';
import type { VehicleSpec } from '../specs.ts';
import { getModels } from '../../assets/ModelRegistry.ts';
import { paintFor as modelPaintFor } from '../../assets/palette.ts';
import { pickVehicleModel, specForModel } from './fromManifest.ts';
import { buildRegistryVehicle } from './registryModel.ts';

export type { VehicleModel } from './types.ts';

export interface BuiltVehicle {
  model: VehicleModel;
  /** Spezifikation passend zum gewählten Modell (Box und Räder aus den Modellmaßen). */
  spec: VehicleSpec;
  /** ID des Registry-Modells oder null (prozeduraler Rückfall, z. B. Zweiräder ohne Modell). */
  modelId: string | null;
}

/**
 * Baut Modell und passende Spezifikation für ein Fahrzeug. Modell und Lackfarbe sind deterministisch aus
 * der ID (gleiche Parkposition -> gleiches Auto). Ohne passendes Registry-Modell: prozedurales Modell.
 */
export function buildVehicle(scene: Scene, kind: VehicleKind, id: number): BuiltVehicle {
  const base = VEHICLE_SPECS[kind as GroundVehicleKind]; // Parkpositionen tragen nur Bodenfahrzeuge
  const name = `vehicle-${kind}-${id}`;
  const registry = getModels();
  const entry = pickVehicleModel(registry?.manifest ?? null, kind, id);
  if (registry && entry) {
    const spec = specForModel(base, entry);
    return {
      model: buildRegistryVehicle(scene, registry, entry, spec, modelPaintFor(id), name),
      spec,
      modelId: entry.id,
    };
  }
  const paint = paintFor(kind, id);
  const model =
    kind === VehicleKind.Car ? buildCar(scene, base, paint, name) : buildTwoWheeler(scene, base, paint, name);
  return { model, spec: base, modelId: null };
}

/** Nur das Modell (Kompatibilität für ältere Aufrufer). */
export function buildVehicleModel(scene: Scene, kind: VehicleKind, id: number): VehicleModel {
  return buildVehicle(scene, kind, id).model;
}
