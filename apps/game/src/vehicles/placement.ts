import type { VehicleSpec } from './specs.ts';

/** Höhe des Fahrzeugmittelpunkts über dem Boden im Ruhezustand (Federn unter Eigengewicht eingefedert). */
export function restHeight(spec: VehicleSpec): number {
  const perWheel = (spec.mass * 9.81) / spec.wheels.length;
  const sag = perWheel / spec.suspension.stiffness;
  const mountY = spec.wheels[0].y;
  return -mountY + spec.suspension.rest - sag;
}
