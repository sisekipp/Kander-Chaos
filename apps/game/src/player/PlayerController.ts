import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import type { Scene } from '@babylonjs/core/scene';
import { CameraRig } from '../camera/CameraRig.ts';
import type { Vehicle } from '../vehicles/Vehicle.ts';
import { Walker, type WalkerWorld } from './Walker.ts';
import type { RouteFollower } from './route.ts';
import { consumeAction, input } from './input.ts';
import { drivePedals } from './autoGas.ts';
import { ENTER_RANGE, EXIT_BRAKE_SPEED, chooseExit, exitCandidates } from './enterExit.ts';
import { exitIsFree } from './exitProbe.ts';

export type PlayerState = { kind: 'walking' } | { kind: 'driving'; vehicle: Vehicle; exiting: boolean };

/** Was der Controller von der Fahrzeugverwaltung braucht. */
export interface VehicleHost {
  nearest(x: number, z: number, maxDist: number): Vehicle | null;
  setDriven(v: Vehicle | null): void;
}

const CAMERA_OFFSET = new Vector3(0, 1.5, 0);
const DRIVE_CAMERA_OFFSET = new Vector3(0, 1.2, 0);

/** Spieler-Zustandsmaschine: zu Fuß ↔ fahrend; verbindet Figur, Fahrzeug, Kamera und Messfahrt. */
export class PlayerController {
  readonly walker: Walker;
  readonly rig: CameraRig;
  state: PlayerState = { kind: 'walking' };
  route: RouteFollower | null = null;
  vehicles: VehicleHost | null = null;
  /** „Einfach“-Modus (Auto-Gas), von der UI gesetzt. */
  simpleDriving = true;

  constructor(
    private readonly scene: Scene,
    camera: ArcRotateCamera,
    private readonly world: WalkerWorld,
    start: Vector3,
    usePhysics: boolean,
  ) {
    this.walker = new Walker(scene, world, start, usePhysics);
    this.rig = new CameraRig(camera);
    this.rig.jumpTo(start.add(CAMERA_OFFSET));
  }

  get vehicle(): Vehicle | null {
    return this.state.kind === 'driving' ? this.state.vehicle : null;
  }

  get position(): Vector3 {
    return this.vehicle?.position ?? this.walker.position;
  }

  get velocity(): Vector3 {
    return this.vehicle?.sim.velocity ?? this.walker.velocity;
  }

  get heading(): number {
    return this.vehicle?.sim.heading ?? this.walker.yaw;
  }

  get isFrozen(): boolean {
    return this.vehicle ? false : this.walker.frozen;
  }

  /** Steht ein Fahrzeug in Reichweite (für den Einsteigen-Knopf)? */
  get canEnter(): boolean {
    return (
      this.state.kind === 'walking' &&
      !this.walker.frozen &&
      !!this.vehicles?.nearest(this.walker.position.x, this.walker.position.z, ENTER_RANGE)
    );
  }

  /** Flugmodus: Figur bleibt reglos stehen (kein Update, keine Eingabe), bis `resume` aufgerufen wird. */
  suspended = false;

  suspend(): void {
    this.suspended = true;
  }

  /**
   * Flug beenden: ohne Ziel bleibt die Figur, wo sie war (sie wird wie nach einem Teleport neu eingesetzt,
   * sobald die Kollision ihrer Kachel wieder geladen ist); mit Ziel landet sie dort.
   */
  resume(land?: { x: number; z: number }): void {
    this.suspended = false;
    input.jump = false;
    input.flyUp = false;
    input.flyDown = false;
    const p = land ?? this.walker.position;
    this.walker.placeAt(p.x, p.z);
    if (land) this.rig.jumpTo(this.walker.position.add(CAMERA_OFFSET));
  }

  /** Figur an eine neue Stelle setzen (Spielstand, Messfahrt, Tests). Steigt vorher aus. */
  teleport(x: number, z: number): void {
    if (this.vehicle) this.leaveVehicle(true);
    this.walker.placeAt(x, z);
    this.rig.jumpTo(this.walker.position.add(CAMERA_OFFSET));
  }

  enter(v: Vehicle): void {
    if (v.wrecked) return;
    this.state = { kind: 'driving', vehicle: v, exiting: false };
    this.vehicles?.setDriven(v);
    this.walker.figure.setVisible(false);
    this.walker.rideAlong(v.position.x, v.position.y, v.position.z);
    this.rig.setMode('chase');
  }

  /** Aussteigen anfordern: über 15 km/h wird zuerst automatisch gebremst. */
  requestExit(): void {
    if (this.state.kind === 'driving') this.state.exiting = true;
  }

  /** Sofort aussteigen (z. B. bei Totalschaden oder Teleport). */
  leaveVehicle(force = false): void {
    if (this.state.kind !== 'driving') return;
    const v = this.state.vehicle;
    if (!force && v.speed > 1) return;
    v.sim.controls.gas = 0;
    v.sim.controls.steer = 0;
    v.sim.controls.brake = 1;
    const p = v.position;
    const [w, , l] = v.sim.spec.box;
    const cands = exitCandidates(p.x, p.z, v.sim.heading, w / 2, l / 2);
    const exit = chooseExit(cands, (c) => exitIsFree(this.scene, v.sim.body, p, c, this.world.heightAt(c.x, c.z)));
    if (exit) this.walker.placeAt(exit.x, exit.z);
    else this.walker.placeAt(p.x, p.z, p.y + 1.5); // notfalls oben drauf
    this.walker.figure.setVisible(true);
    this.vehicles?.setDriven(null);
    this.state = { kind: 'walking' };
    this.rig.setMode('walk');
  }

  update(dtMs: number): void {
    if (this.suspended) return;
    const dt = Math.min(dtMs, 100) / 1000;
    const action = consumeAction();
    if (this.route) {
      const r = this.route.step(dt);
      this.walker.moveKinematic(r.x, r.z, r.vx, r.vz);
      if (this.route.done) this.route = null;
    } else if (this.state.kind === 'driving') {
      this.updateDriving(action);
    } else {
      if (action) {
        const v = this.vehicles?.nearest(this.walker.position.x, this.walker.position.z, ENTER_RANGE);
        if (v) this.enter(v);
      }
      if (this.state.kind === 'walking') this.walker.update(dtMs, this.rig.forwardYaw);
    }
    const target = this.position.add(this.vehicle ? DRIVE_CAMERA_OFFSET : CAMERA_OFFSET);
    this.rig.update(dtMs, target, this.heading, this.velocity.length());
  }

  private updateDriving(action: boolean): void {
    if (this.state.kind !== 'driving') return;
    const v = this.state.vehicle;
    if (action) this.state.exiting = true;
    if (v.wrecked) return this.leaveVehicle(true);
    const c = v.sim.controls;
    if (this.state.exiting) {
      c.gas = 0;
      c.steer = 0;
      c.brake = 1;
      if (v.speed < EXIT_BRAKE_SPEED * 0.25) this.leaveVehicle(true);
      return;
    }
    const pedals = drivePedals(
      { moveX: input.moveX, moveY: input.moveY, gas: input.gas, brake: input.brake },
      this.simpleDriving,
    );
    c.steer = pedals.steer;
    c.gas = pedals.gas;
    c.brake = pedals.brake;
    // Figur mitführen (unsichtbar), damit Spielstand/Streaming die richtige Position kennen
    this.walker.rideAlong(v.position.x, v.position.y, v.position.z);
  }

  dispose(): void {
    this.walker.dispose();
  }
}
