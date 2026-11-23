import { Quaternion } from '@babylonjs/core/Maths/math.vector';
import type { HelicopterModel } from './HelicopterModel.ts';
import { initialHeli, stepHeli, type HeliEnv, type HeliInput, type HeliState } from './heliMath.ts';

/** Leerlauf-Eingabe ohne Spieler (Rotor läuft aus). */
const IDLE: HeliInput = { moveX: 0, moveY: 0, up: false, down: false, fast: false, camYaw: 0, engine: false };
/** Rotordrehzahl bei voller Leistung (rad/s): Hauptrotor ca. 6 U/s, Heckrotor schneller. */
const MAIN_SPIN = 38;
const TAIL_SPIN = 110;

/** Ein Hubschrauber: Flugzustand (heliMath) und Darstellung. */
export class Helicopter {
  state: HeliState;
  /** Wurde schon geflogen (bleibt dann stehen, wo er gelandet ist)? */
  moved = false;

  constructor(
    readonly id: string,
    readonly model: HelicopterModel,
    x: number,
    y: number,
    z: number,
    heading: number,
  ) {
    this.state = initialHeli(x, y, z, heading);
    this.apply(0);
  }

  get position() {
    return this.model.root.position;
  }

  update(dtMs: number, input: HeliInput | null, env: HeliEnv): void {
    const dt = Math.min(dtMs, 100) / 1000;
    if (input || this.state.rotor > 0.001 || !this.state.grounded) {
      this.state = stepHeli(this.state, input ?? IDLE, dt, env);
      if (input) this.moved = true;
    }
    this.apply(dt);
  }

  private apply(dt: number): void {
    const s = this.state;
    const r = this.model.root;
    r.position.set(s.x, s.y, s.z);
    // Babylon: positive Drehung um x neigt +z (Bug) nach unten -> Bugneigung nach vorn = −pitch
    r.rotationQuaternion = Quaternion.RotationYawPitchRoll(s.heading, -s.pitch, s.roll);
    this.model.rotorMain.rotation.y += s.rotor * MAIN_SPIN * dt;
    this.model.rotorTail.rotation.x += s.rotor * TAIL_SPIN * dt;
  }

  dispose(): void {
    this.model.dispose();
  }
}
