import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CharacterSupportedState, PhysicsCharacterController } from '@babylonjs/core/Physics/v2/characterController';
import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import type { Scene } from '@babylonjs/core/scene';
import { input } from './input.ts';
import type { RouteFollower } from './route.ts';

export const WALK_SPEED = 5;
export const FAST_SPEED = 80 / 3.6; // 80 km/h

export interface PlayerWorld {
  /** Geländehöhe an (x, z) oder null, wenn unbekannt. */
  heightAt(x: number, z: number): number | null;
  /** Kollision für die Kachel an (x, z) bereit? */
  isCollisionReady(x: number, z: number): boolean;
}

/**
 * Spielfigur für den Testmodus. Normal: Havok-Character-Controller (Kollision mit Gelände und
 * Gebäuden). Schnellfahrmodus und Messroute: kinematisch über dem Gelände (Streaming-Test).
 * Solange die Kollision der aktuellen Kachel fehlt, bleibt die Figur stehen (kein Durchfallen).
 */
export class Player {
  readonly root: TransformNode;
  readonly velocity = new Vector3();
  private cc: PhysicsCharacterController | null = null;
  private yaw = 0;
  private frozen = true;
  route: RouteFollower | null = null;
  private readonly materials: StandardMaterial[] = [];
  private readonly meshes: Mesh[] = [];

  constructor(
    private readonly scene: Scene,
    private readonly camera: ArcRotateCamera,
    private readonly world: PlayerWorld,
    start: Vector3,
    usePhysics: boolean,
  ) {
    this.root = new TransformNode('player', scene);
    this.root.position.copyFrom(start);
    const body = CreateCapsule('player-body', { height: 1.75, radius: 0.33, tessellation: 10 }, scene);
    body.position.y = 0.875;
    const head = CreateSphere('player-head', { diameter: 0.42, segments: 8 }, scene);
    head.position.set(0, 1.62, 0.06);
    const shadow = CreateDisc('player-shadow', { radius: 0.5, tessellation: 16 }, scene);
    shadow.rotation.x = Math.PI / 2;
    shadow.position.y = 0.05;
    const mat = (name: string, c: Color3, alpha = 1) => {
      const m = new StandardMaterial(name, scene);
      m.diffuseColor = c;
      m.specularColor = Color3.Black();
      m.alpha = alpha;
      this.materials.push(m);
      return m;
    };
    body.material = mat('player-body', new Color3(0.95, 0.45, 0.2));
    head.material = mat('player-head', new Color3(0.98, 0.82, 0.66));
    shadow.material = mat('player-shadow', Color3.Black(), 0.35); // Blob-Schatten (Qualität "Niedrig")
    for (const m of [body, head, shadow]) {
      m.parent = this.root;
      m.isPickable = false;
      this.meshes.push(m);
    }
    if (usePhysics) {
      this.cc = new PhysicsCharacterController(
        start.add(new Vector3(0, 0.9, 0)),
        { capsuleHeight: 1.8, capsuleRadius: 0.33 },
        scene,
      );
      this.cc.maxCharacterSpeedForSolver = FAST_SPEED + 5;
    }
    camera.setTarget(this.root.position.add(new Vector3(0, 1.5, 0)), false, false, true);
    camera.radius = 9;
    camera.beta = 1.2;
  }

  get position(): Vector3 {
    return this.root.position;
  }

  get heading(): number {
    return this.yaw;
  }

  get isFrozen(): boolean {
    return this.frozen;
  }

  /** Setzt die Figur an eine neue Stelle (z. B. Spielstand laden). */
  teleport(x: number, z: number): void {
    const y = this.world.heightAt(x, z) ?? this.root.position.y;
    this.root.position.set(x, y, z);
    this.cc?.setPosition(new Vector3(x, y + 0.9, z));
    this.cc?.setVelocity(Vector3.Zero());
    this.frozen = true;
  }

  update(dtMs: number): void {
    const dt = Math.min(dtMs, 100) / 1000;
    if (dt <= 0) return;

    // Kamera: Wischen dreht um die Figur
    this.camera.alpha -= input.lookDX;
    this.camera.beta = Math.min(1.45, Math.max(0.45, this.camera.beta - input.lookDY));
    input.lookDX = 0;
    input.lookDY = 0;

    const p = this.root.position;
    if (this.route) {
      const r = this.route.step(dt);
      const y = this.world.heightAt(r.x, r.z) ?? p.y;
      p.set(r.x, y, r.z);
      this.velocity.set(r.vx, 0, r.vz);
      if (Math.hypot(r.vx, r.vz) > 0.1) this.yaw = Math.atan2(r.vx, r.vz);
      this.cc?.setPosition(new Vector3(p.x, y + 0.9, p.z));
      if (this.route.done) this.route = null;
      this.finishFrame();
      return;
    }

    // Einfrieren, bis die Kollision der aktuellen Kachel steht
    const ready = this.world.isCollisionReady(p.x, p.z);
    if (!ready) {
      this.frozen = true;
      this.velocity.setAll(0);
      this.finishFrame();
      return;
    }
    if (this.frozen) {
      this.frozen = false;
      const y = this.world.heightAt(p.x, p.z);
      if (y !== null && this.cc) this.cc.setPosition(new Vector3(p.x, y + 1.0, p.z));
    }

    // Bewegungsrichtung relativ zur Kamera
    const camYaw = -this.camera.alpha - Math.PI / 2;
    const fx = Math.sin(camYaw),
      fz = Math.cos(camYaw);
    const rx = Math.cos(camYaw),
      rz = -Math.sin(camYaw);
    let mx = rx * input.moveX + fx * input.moveY;
    let mz = rz * input.moveX + fz * input.moveY;
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    const speed = input.fast ? FAST_SPEED : WALK_SPEED;
    if (len > 0.05) this.yaw = Math.atan2(mx, mz);

    if (input.fast || !this.cc) {
      // Kinematisch über dem Gelände
      p.x += mx * speed * dt;
      p.z += mz * speed * dt;
      p.y = this.world.heightAt(p.x, p.z) ?? p.y;
      this.velocity.set(mx * speed, 0, mz * speed);
      this.cc?.setPosition(new Vector3(p.x, p.y + 0.9, p.z));
    } else {
      const cc = this.cc;
      const up = Vector3.Up();
      const down = new Vector3(0, -1, 0);
      const gravity = new Vector3(0, -18, 0);
      const support = cc.checkSupport(dt, down);
      const desired = new Vector3(mx * speed, 0, mz * speed);
      const current = cc.getVelocity();
      let out: Vector3;
      if (support.supportedState === CharacterSupportedState.SUPPORTED) {
        out = cc.calculateMovement(
          dt,
          new Vector3(fx, 0, fz),
          support.averageSurfaceNormal,
          current,
          support.averageSurfaceVelocity,
          desired,
          up,
        );
        if (input.jump) out.y = 6;
      } else {
        out = current.add(gravity.scale(dt));
        out.x = desired.x;
        out.z = desired.z;
      }
      input.jump = false;
      cc.setVelocity(out);
      cc.integrate(dt, support, gravity);
      const cp = cc.getPosition();
      p.set(cp.x, cp.y - 0.9, cp.z);
      this.velocity.copyFrom(out);
      // Notbremse: unter das Gelände gefallen -> zurück nach oben
      const gy = this.world.heightAt(p.x, p.z);
      if (gy !== null && p.y < gy - 2) {
        p.y = gy;
        cc.setPosition(new Vector3(p.x, gy + 1, p.z));
        cc.setVelocity(Vector3.Zero());
      }
    }
    this.finishFrame();
  }

  private finishFrame(): void {
    this.root.rotationQuaternion = Quaternion.FromEulerAngles(0, this.yaw, 0);
    const target = this.root.position.add(new Vector3(0, 1.5, 0));
    // Weich nachführen
    const ct = this.camera.target;
    this.camera.setTarget(Vector3.Lerp(ct, target, 0.35), false, false, true);
  }

  dispose(): void {
    this.cc?.dispose();
    for (const m of this.meshes) m.dispose();
    for (const m of this.materials) m.dispose();
    this.root.dispose();
  }
}
