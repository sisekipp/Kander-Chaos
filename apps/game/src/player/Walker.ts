import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CharacterSupportedState, PhysicsCharacterController } from '@babylonjs/core/Physics/v2/characterController';
import type { Scene } from '@babylonjs/core/scene';
import { input } from './input.ts';
import { cameraRelativeMove } from './movement.ts';
import { FAST_SPEED, WALK_SPEED } from './constants.ts';
import { createFigure, type Figure } from './figure.ts';

export interface WalkerWorld {
  heightAt(x: number, z: number): number | null;
  isCollisionReady(x: number, z: number): boolean;
}

const GRAVITY = new Vector3(0, -18, 0);
const DOWN = new Vector3(0, -1, 0);

/**
 * Die Spielfigur zu Fuß: Havok-Character-Controller (Kollision mit Gelände/Gebäuden) bzw.
 * kinematisch im Schnellmodus oder ohne Physik. Friert ein, solange die Kachel keine Kollision hat.
 */
export class Walker {
  readonly figure: Figure;
  readonly velocity = new Vector3();
  yaw = 0;
  frozen = true;
  private readonly cc: PhysicsCharacterController | null;

  constructor(
    scene: Scene,
    private readonly world: WalkerWorld,
    start: Vector3,
    usePhysics: boolean,
  ) {
    this.figure = createFigure(scene);
    this.figure.root.position.copyFrom(start);
    this.cc = usePhysics
      ? new PhysicsCharacterController(
          start.add(new Vector3(0, 0.9, 0)),
          { capsuleHeight: 1.8, capsuleRadius: 0.33 },
          scene,
        )
      : null;
    if (this.cc) this.cc.maxCharacterSpeedForSolver = FAST_SPEED + 5;
  }

  get position(): Vector3 {
    return this.figure.root.position;
  }

  /** Setzt die Figur an (x, z) auf den Boden (bzw. auf Höhe y) und friert sie ein, bis die Kollision steht. */
  placeAt(x: number, z: number, y?: number): void {
    const gy = y ?? this.world.heightAt(x, z) ?? this.position.y;
    this.position.set(x, gy, z);
    this.cc?.setPosition(new Vector3(x, gy + 0.9, z));
    this.cc?.setVelocity(Vector3.Zero());
    this.velocity.setAll(0);
    this.frozen = true;
  }

  /** Kinematisch an einen Punkt bewegen (Messfahrt, Mitfahren im Fahrzeug). */
  moveKinematic(x: number, z: number, vx: number, vz: number, y?: number): void {
    const gy = y ?? this.world.heightAt(x, z) ?? this.position.y;
    this.position.set(x, gy, z);
    this.velocity.set(vx, 0, vz);
    if (Math.hypot(vx, vz) > 0.1) this.yaw = Math.atan2(vx, vz);
    this.cc?.setPosition(new Vector3(x, gy + 0.9, z));
    this.applyRotation();
  }

  /**
   * Mitfahren im Fahrzeug: Figur (unsichtbar) folgt der Position, der Character Controller wird
   * 50 m tiefer geparkt – seine Kollisionskapsel würde sonst das Fahrzeug blockieren.
   */
  rideAlong(x: number, y: number, z: number): void {
    this.position.set(x, y, z);
    this.velocity.setAll(0);
    this.cc?.setPosition(new Vector3(x, y - 50, z));
    this.cc?.setVelocity(Vector3.Zero());
  }

  update(dtMs: number, camYaw: number): void {
    const dt = Math.min(dtMs, 100) / 1000;
    if (dt <= 0) return;
    const p = this.position;
    if (!this.world.isCollisionReady(p.x, p.z)) {
      this.frozen = true;
      this.velocity.setAll(0);
      return;
    }
    if (this.frozen) {
      this.frozen = false;
      const y = this.world.heightAt(p.x, p.z);
      if (y !== null && this.cc) this.cc.setPosition(new Vector3(p.x, y + 1.0, p.z));
    }
    const { mx, mz, len } = cameraRelativeMove(input.moveX, input.moveY, camYaw);
    const speed = input.fast ? FAST_SPEED : WALK_SPEED;
    if (len > 0.05) this.yaw = Math.atan2(mx, mz);
    if (input.fast || !this.cc) {
      p.x += mx * speed * dt;
      p.z += mz * speed * dt;
      p.y = this.world.heightAt(p.x, p.z) ?? p.y;
      this.velocity.set(mx * speed, 0, mz * speed);
      this.cc?.setPosition(new Vector3(p.x, p.y + 0.9, p.z));
    } else {
      this.stepPhysics(dt, mx * speed, mz * speed, camYaw);
    }
    this.applyRotation();
  }

  private stepPhysics(dt: number, vx: number, vz: number, camYaw: number): void {
    const cc = this.cc!;
    const p = this.position;
    const support = cc.checkSupport(dt, DOWN);
    const desired = new Vector3(vx, 0, vz);
    const current = cc.getVelocity();
    let out: Vector3;
    if (support.supportedState === CharacterSupportedState.SUPPORTED) {
      const fwd = new Vector3(Math.sin(camYaw), 0, Math.cos(camYaw));
      out = cc.calculateMovement(
        dt,
        fwd,
        support.averageSurfaceNormal,
        current,
        support.averageSurfaceVelocity,
        desired,
        Vector3.Up(),
      );
      if (input.jump) out.y = 6;
    } else {
      out = current.add(GRAVITY.scale(dt));
      out.x = desired.x;
      out.z = desired.z;
    }
    input.jump = false;
    cc.setVelocity(out);
    cc.integrate(dt, support, GRAVITY);
    const cp = cc.getPosition();
    p.set(cp.x, cp.y - 0.9, cp.z);
    this.velocity.copyFrom(out);
    // Notbremse: unter das Gelände gefallen -> zurück nach oben
    const gy = this.world.heightAt(p.x, p.z);
    if (gy !== null && p.y < gy - 2) this.placeAt(p.x, p.z, gy);
  }

  private applyRotation(): void {
    this.figure.root.rotationQuaternion = Quaternion.FromEulerAngles(0, this.yaw, 0);
  }

  dispose(): void {
    this.cc?.dispose();
    this.figure.dispose();
  }
}
