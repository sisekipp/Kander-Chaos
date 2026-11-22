import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { VehicleKind } from '@kandern/world-format';
import { buildVehicleModel } from './models/index.ts';
import { RaycastVehicle } from './physics/RaycastVehicle.ts';
import { VEHICLE_SPECS } from './specs.ts';
import { restHeight } from './placement.ts';

/** Ein Fahrzeug in der Welt: Modell + Physik + Herkunft (Parkposition) und Zustand. */
export class Vehicle {
  readonly sim: RaycastVehicle;
  /** Vom Spieler bewegt (bleibt dann an der neuen Stelle, statt an die Parkposition zurückzukehren). */
  moved = false;
  /** Angestoßen/bewegt sich – bekommt bevorzugt volle Physik. */
  awake = false;
  /** Zustand 0..1 (Schaden folgt in Gruppe 5). */
  health = 1;
  wrecked = false;
  /** Zeitpunkt des Totalschadens (ms), sonst null. */
  wreckedAt: number | null = null;

  constructor(
    scene: Scene,
    readonly id: number,
    readonly kind: VehicleKind,
    readonly spotTile: string,
    x: number,
    groundY: number,
    z: number,
    heading: number,
  ) {
    const spec = VEHICLE_SPECS[kind];
    const model = buildVehicleModel(scene, kind, id);
    this.sim = new RaycastVehicle(scene, spec, model, new Vector3(x, groundY + restHeight(spec), z), heading);
  }

  get position(): Vector3 {
    return this.sim.position;
  }

  get speed(): number {
    return this.sim.isDynamic ? this.sim.velocity.length() : 0;
  }

  dispose(): void {
    this.sim.dispose();
    this.sim.model.dispose();
  }
}
