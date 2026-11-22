import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { PhysicsBody } from '@babylonjs/core/Physics/v2/physicsBody';
import { PhysicsShapeBox } from '@babylonjs/core/Physics/v2/physicsShape';
import { PhysicsActivationControl, PhysicsMotionType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import type { HavokPlugin } from '@babylonjs/core/Physics/v2/Plugins/havokPlugin';
import { PhysicsRaycastResult } from '@babylonjs/core/Physics/physicsRaycastResult';
import type { PhysicsEngine } from '@babylonjs/core/Physics/v2/physicsEngine';
import type { Scene } from '@babylonjs/core/scene';
import type { VehicleModel } from '../models/types.ts';
import type { VehicleSpec } from '../specs.ts';
import { brakeForce, dragForce, driveForce, lateralForce, pedalsFrom, steerAngle, suspensionForce } from './forces.ts';
import { rollTorque, targetLean } from './stabilizer.ts';
import { SelfRightTimer } from './selfRight.ts';
import { GROUP } from './collisionGroups.ts';
import { DEBUG_COLORS, type DebugLines } from '../../engine/debug/DebugLines.ts';

export interface DriveControls {
  steer: number;
  gas: number;
  brake: number;
}

interface WheelState {
  compression: number;
  grounded: boolean;
  spin: number;
}

const G = 9.81;

/** Arcade-Raycast-Fahrzeug auf Havok (Design D1). Kräfte kommen aus `forces.ts`, hier nur Anbindung. */
export class RaycastVehicle {
  readonly body: PhysicsBody;
  readonly controls: DriveControls = { steer: 0, gas: 0, brake: 0 };
  private readonly wheels: WheelState[];
  private readonly ray = new PhysicsRaycastResult();
  private readonly selfRight = new SelfRightTimer();
  private steer = 0;
  private dynamic = false;
  /** Geschwindigkeit zu Beginn des letzten Physikschritts (vor Kontakten) – für die Aufprallstärke. */
  readonly lastVelocity = new Vector3();
  debug: DebugLines | null = null;
  /** Totalschaden: Fahrzeug ist fahruntüchtig. */
  wrecked = false;

  constructor(
    private readonly scene: Scene,
    readonly spec: VehicleSpec,
    readonly model: VehicleModel,
    position: Vector3,
    heading: number,
  ) {
    const root = model.root;
    root.position.copyFrom(position);
    root.rotationQuaternion = Quaternion.FromEulerAngles(0, heading, 0);
    root.computeWorldMatrix(true);
    this.body = new PhysicsBody(root, PhysicsMotionType.STATIC, false, scene);
    const [w, h, l] = spec.box;
    const shape = new PhysicsShapeBox(Vector3.Zero(), Quaternion.Identity(), new Vector3(w, h, l), scene);
    shape.filterMembershipMask = GROUP.VEHICLE;
    shape.material = { friction: 0.4, restitution: 0.15 };
    this.body.shape = shape;
    this.body.setMassProperties({ mass: spec.mass, centerOfMass: new Vector3(0, -spec.comDrop, 0) });
    this.body.setAngularDamping(spec.twoWheeler ? 2.5 : 1.2);
    this.body.setLinearDamping(0.05);
    this.wheels = spec.wheels.map(() => ({ compression: 0, grounded: false, spin: 0 }));
  }

  get isDynamic(): boolean {
    return this.dynamic;
  }

  /** Ruhend (statisch, billig) oder voll simuliert. */
  setDynamic(on: boolean): void {
    if (on === this.dynamic) return;
    this.dynamic = on;
    this.body.setMotionType(on ? PhysicsMotionType.DYNAMIC : PhysicsMotionType.STATIC);
    if (on) {
      this.body.setMassProperties({ mass: this.spec.mass, centerOfMass: new Vector3(0, -this.spec.comDrop, 0) });
      // Ein vorher statischer Körper schläft in Havok – ohne Wecken wirken Kräfte nicht.
      this.setActivation(PhysicsActivationControl.ALWAYS_ACTIVE);
      this.scene.onAfterPhysicsObservable.addOnce(() =>
        this.setActivation(
          this.keepAwake ? PhysicsActivationControl.ALWAYS_ACTIVE : PhysicsActivationControl.SIMULATION_CONTROLLED,
        ),
      );
    }
  }

  private keepAwake = false;

  /** Gefahrenes Fahrzeug dauerhaft wach halten (Kräfte aus der Steuerung wirken sofort). */
  setKeepAwake(on: boolean): void {
    this.keepAwake = on;
    if (this.dynamic)
      this.setActivation(on ? PhysicsActivationControl.ALWAYS_ACTIVE : PhysicsActivationControl.SIMULATION_CONTROLLED);
  }

  private setActivation(mode: PhysicsActivationControl): void {
    (this.scene.getPhysicsEngine()?.getPhysicsPlugin() as HavokPlugin | undefined)?.setActivationControl(
      this.body,
      mode,
    );
  }

  get position(): Vector3 {
    return this.model.root.position;
  }

  get heading(): number {
    const f = this.dir(0, 0, 1);
    return Math.atan2(f.x, f.z);
  }

  get velocity(): Vector3 {
    const v = new Vector3();
    if (this.dynamic) this.body.getLinearVelocityToRef(v);
    return v;
  }

  /** Geschwindigkeit entlang der Fahrzeuglängsachse (m/s, negativ = rückwärts). */
  get forwardSpeed(): number {
    return Vector3.Dot(this.velocity, this.dir(0, 0, 1));
  }

  get groundedWheels(): number {
    return this.wheels.filter((w) => w.grounded).length;
  }

  private dir(x: number, y: number, z: number): Vector3 {
    return Vector3.TransformNormal(new Vector3(x, y, z), this.model.root.getWorldMatrix()).normalize();
  }

  private point(x: number, y: number, z: number): Vector3 {
    return Vector3.TransformCoordinates(new Vector3(x, y, z), this.model.root.getWorldMatrix());
  }

  /** Ein Physik-Teilschritt (aus scene.onBeforePhysicsObservable). */
  step(dt: number): void {
    if (!this.dynamic) return;
    if (this.wrecked) {
      this.body.getLinearVelocityToRef(this.lastVelocity);
      return; // Wrack: keine Antriebs- und Federkräfte mehr (liegt auf dem Unterboden)
    }
    const engine = this.scene.getPhysicsEngine() as PhysicsEngine | null;
    if (!engine) return;
    this.model.root.computeWorldMatrix(true);
    const s = this.spec;
    const up = this.dir(0, 1, 0),
      fwd = this.dir(0, 0, 1),
      right = this.dir(1, 0, 0);
    const v = new Vector3(),
      w = new Vector3();
    this.body.getLinearVelocityToRef(v);
    this.body.getAngularVelocityToRef(w);
    this.lastVelocity.copyFrom(v);
    const com = this.body.getObjectCenterWorld();
    const fSpeed = Vector3.Dot(v, fwd);
    const pedals = pedalsFrom(this.controls.gas, this.controls.brake, fSpeed);
    this.steer += (steerAngle(this.controls.steer, fSpeed, s.maxSpeed, s.maxSteer) - this.steer) * Math.min(1, dt * 8);
    const nDrive = s.wheels.filter((wh) => wh.drive).length;
    const share = s.mass / s.wheels.length;
    const rayLen = s.suspension.rest + s.suspension.travel;
    s.wheels.forEach((wh, i) => {
      const st = this.wheels[i];
      const mount = this.point(wh.x, wh.y, wh.z);
      const end = mount.subtract(up.scale(rayLen));
      engine.raycastToRef(mount, end, this.ray, {
        ignoreBody: this.body,
        collideWith: ~(GROUP.DEBRIS | GROUP.CHARACTER),
      });
      const prev = st.compression;
      st.grounded = this.ray.hasHit;
      st.compression = this.ray.hasHit ? Math.max(0, s.suspension.rest - this.ray.hitDistance) : 0;
      if (!this.ray.hasHit) {
        this.debug?.line(mount, end, DEBUG_COLORS.rayMiss);
        return;
      }
      this.debug?.line(mount, this.ray.hitPointWorld, DEBUG_COLORS.rayHit);
      const load = suspensionForce(
        st.compression,
        (st.compression - prev) / dt,
        s.suspension.stiffness,
        s.suspension.damping,
      );
      const wheelFwd = wh.steer ? Vector3.TransformNormal(fwd, rotationAround(up, this.steer)) : fwd;
      const wheelRight = Vector3.Cross(up, wheelFwd).normalize();
      const pv = v.add(Vector3.Cross(w, mount.subtract(com)));
      const lat = lateralForce(Vector3.Dot(pv, wheelRight), s.grip, Math.max(load, share * G * 0.3), share);
      let long = brakeForce(Vector3.Dot(pv, wheelFwd), pedals.brake, s.brakeForce / s.wheels.length);
      if (wh.drive) long += driveForce(pedals.throttle, fSpeed, s.maxSpeed, s.engineForce, s.reverseSpeed) / nDrive;
      const at = mount.add(up.scale(0.15));
      const force = up.scale(load).add(wheelRight.scale(lat)).add(wheelFwd.scale(long));
      this.body.applyForce(force, at);
      this.debug?.line(at, at.add(force.scale(1 / (s.mass * G))), DEBUG_COLORS.force);
      st.spin += (Vector3.Dot(pv, wheelFwd) / wh.radius) * dt;
    });
    const grounded = this.groundedWheels;
    if (grounded > 0) {
      this.body.applyForce(fwd.scale(dragForce(fSpeed, s.mass)).add(up.scale(-s.downforce * fSpeed * fSpeed)), com);
    }
    if (Math.abs(fSpeed) > s.maxSpeed * 1.05)
      this.body.setLinearVelocity(v.scale((s.maxSpeed * 1.05) / Math.abs(fSpeed)));
    if (s.twoWheeler) this.stabilize(dt, fwd, right, w, fSpeed);
    if (this.selfRight.update(dt, grounded, Vector3.Dot(up, Vector3.Up()), v.length())) this.rightUp();
  }

  /** Zweirad aufrecht halten bzw. in die Kurve neigen (Winkelgeschwindigkeit direkt korrigieren). */
  private stabilize(dt: number, fwd: Vector3, right: Vector3, w: Vector3, fSpeed: number): void {
    // Babylon ist linkshändig: positive Drehung um die Längsachse hebt die rechte Seite -> Neigung nimmt ab.
    // Daher ist die Neigungsänderung d(roll)/dt = -ω·vorne, und eine Neigungsbeschleunigung α wirkt als Δω = -α·dt.
    const roll = -Math.asin(Math.max(-1, Math.min(1, right.y)));
    const rollRate = -Vector3.Dot(w, fwd);
    const target = targetLean(this.controls.steer, fSpeed, this.spec.maxSpeed, this.spec.maxLean);
    const accel = rollTorque(roll, rollRate, target, 60, 12); // rad/s² (Trägheit eingerechnet)
    this.body.setAngularVelocity(w.add(fwd.scale(-accel * dt)));
  }

  /** Aufrichten: Gierwinkel behalten, 1 m anheben, Bewegung stoppen. */
  rightUp(): void {
    const p = this.position.add(new Vector3(0, 1, 0));
    this.teleport(p, this.heading);
  }

  teleport(p: Vector3, heading: number): void {
    const root = this.model.root;
    this.body.disablePreStep = false;
    root.position.copyFrom(p);
    root.rotationQuaternion = Quaternion.FromEulerAngles(0, heading, 0);
    if (this.dynamic) {
      this.body.setLinearVelocity(Vector3.Zero());
      this.body.setAngularVelocity(Vector3.Zero());
    }
    this.scene.onAfterPhysicsObservable.addOnce(() => (this.body.disablePreStep = true));
  }

  /** Räder drehen, lenken und einfedern (pro Bild). */
  updateVisuals(): void {
    const s = this.spec;
    this.model.wheels.forEach((node, i) => {
      const wh = s.wheels[i],
        st = this.wheels[i];
      node.rotation.x = st.spin;
      if (!s.twoWheeler) {
        node.position.y = wh.y - (st.grounded ? s.suspension.rest - st.compression : s.suspension.rest) + wh.radius;
        if (wh.steer) node.rotation.y = this.steer;
      }
    });
    if (this.model.steerNode) this.model.steerNode.rotation.y = this.steer;
  }

  dispose(): void {
    this.body.shape?.dispose();
    this.body.dispose();
  }
}

function rotationAround(axis: Vector3, angle: number): Matrix {
  return Matrix.RotationAxis(axis, angle);
}
