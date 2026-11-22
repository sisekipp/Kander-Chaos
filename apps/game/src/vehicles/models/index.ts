import type { Scene } from '@babylonjs/core/scene';
import { VehicleKind } from '@kandern/world-format';
import { VEHICLE_SPECS } from '../specs.ts';
import { buildCar } from './car.ts';
import { buildTwoWheeler } from './twoWheeler.ts';
import { paintFor } from './palette.ts';
import type { VehicleModel } from './types.ts';

export type { VehicleModel } from './types.ts';

/** Baut das Modell für eine Fahrzeugart; Farbe deterministisch aus der ID. */
export function buildVehicleModel(scene: Scene, kind: VehicleKind, id: number): VehicleModel {
  const spec = VEHICLE_SPECS[kind];
  const paint = paintFor(kind, id);
  const name = `vehicle-${kind}-${id}`;
  return kind === VehicleKind.Car ? buildCar(scene, spec, paint, name) : buildTwoWheeler(scene, spec, paint, name);
}
