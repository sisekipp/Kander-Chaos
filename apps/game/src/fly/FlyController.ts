import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { cameraForwardYaw } from '../camera/followMath.ts';
import { input } from '../player/input.ts';
import { autopilot, type FlyWaypoint } from './autopilot.ts';
import { fullDetailFor } from './detailRule.ts';
import { stepFlight, type FlightEnv, type FlightInput, type FlightState } from './flyMath.ts';

/** Abstand Kamera–Ziel im Flug (Ich-Kamera). */
const FLY_RADIUS = 0.5;

export interface FlyFocus {
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  /** Volle Detailstufe (Ring 0) gewünscht? */
  fullDetail: boolean;
}

/**
 * Babylon-Adapter des Flugmodus auf die vorhandene ArcRotateCamera (Design D1/D3): Ziel = Flugposition,
 * kleiner Radius, alpha/beta = Blickrichtung. Beim Start bleibt die Kamera an ihrer Stelle (kein Sprung).
 */
export class FlyController {
  private state: FlightState;
  private ground: number;
  private detail = true;
  private route: { points: FlyWaypoint[]; index: number } | null = null;
  private readonly saved: { lower: number | null; upper: number | null; radius: number; beta: number };

  constructor(
    private readonly camera: ArcRotateCamera,
    private readonly heightAt: (x: number, z: number) => number | null,
    private readonly bounds: FlightEnv['bounds'],
  ) {
    this.saved = {
      lower: camera.lowerRadiusLimit,
      upper: camera.upperBetaLimit,
      radius: camera.radius,
      beta: camera.beta,
    };
    const p = camera.position;
    this.ground = heightAt(p.x, p.z) ?? p.y - 10;
    this.state = { x: p.x, y: Math.max(p.y, this.ground + 2), z: p.z, vx: 0, vy: 0, vz: 0 };
    camera.lowerRadiusLimit = FLY_RADIUS;
    camera.upperBetaLimit = Math.PI - 0.15;
    camera.radius = FLY_RADIUS;
    this.applyCamera();
  }

  get position(): Vector3 {
    return new Vector3(this.state.x, this.state.y, this.state.z);
  }

  /** Höhe über dem Gelände unter der Kamera. */
  get altitude(): number {
    return this.state.y - this.ground;
  }

  /** Blickrichtung (Gierwinkel) für „Hier landen“. */
  get yaw(): number {
    return cameraForwardYaw(this.camera.alpha);
  }

  /** Messroute: an den ersten Wegpunkt springen und den Autopiloten fliegen lassen. */
  startRoute(points: FlyWaypoint[]): void {
    const p = points[0];
    this.ground = this.heightAt(p.x, p.z) ?? this.ground;
    this.state = { x: p.x, y: this.ground + p.altitude, z: p.z, vx: 0, vy: 0, vz: 0 };
    this.route = { points, index: 1 };
  }

  get routeActive(): boolean {
    return this.route !== null;
  }

  /** Eingabe dieses Bilds: Autopilot (Messroute) oder Spieler. */
  private flightInput(): FlightInput {
    const r = this.route;
    if (r) {
      const step = autopilot(this.state, this.ground, r.points, r.index, this.yaw);
      r.index = step.index;
      if (step.done) this.route = null;
      // Blick in Flugrichtung, leicht nach unten
      this.camera.alpha = -step.input.yaw - Math.PI / 2;
      this.camera.beta = 1.3;
      return step.input;
    }
    return {
      moveX: input.moveX,
      moveY: input.moveY,
      up: input.flyUp,
      down: input.flyDown,
      fast: input.fast,
      yaw: this.yaw,
    };
  }

  /** Geschwindigkeit von außen anpassen (weiche Grenze vor gesperrten Regionen). */
  adjustVelocity(f: (vx: number, vz: number) => { vx: number; vz: number }): void {
    const v = f(this.state.vx, this.state.vz);
    this.state = { ...this.state, vx: v.vx, vz: v.vz };
  }

  update(dtMs: number): FlyFocus {
    const dt = Math.min(dtMs, 100) / 1000;
    this.camera.alpha -= input.lookDX;
    this.camera.beta = Math.min(Math.PI - 0.15, Math.max(0.15, this.camera.beta - input.lookDY));
    input.lookDX = 0;
    input.lookDY = 0;
    const env: FlightEnv = {
      groundAt: (x, z) => {
        const h = this.heightAt(x, z);
        if (h !== null) this.ground = h;
        return h ?? this.ground;
      },
      bounds: this.bounds,
    };
    this.state = stepFlight(this.state, this.flightInput(), dt, env);
    this.detail = fullDetailFor(this.detail, this.altitude);
    this.applyCamera();
    const s = this.state;
    return { x: s.x, y: s.y, z: s.z, vx: s.vx, vz: s.vz, fullDetail: this.detail };
  }

  /** Kamera so setzen, dass sie an der Flugposition steht und in Blickrichtung schaut. */
  private applyCamera(): void {
    const { alpha, beta } = this.camera;
    // ArcRotate: Kamera = Ziel + r·(cos α sin β, cos β, sin α sin β) -> Ziel liegt um r davor
    const off = new Vector3(Math.cos(alpha) * Math.sin(beta), Math.cos(beta), Math.sin(alpha) * Math.sin(beta)).scale(
      FLY_RADIUS,
    );
    this.camera.setTarget(this.position.subtract(off), false, false, true);
  }

  /** Kamera-Einstellungen wiederherstellen (Radius gleitet im Kamera-Rig zurück). */
  dispose(): void {
    this.camera.lowerRadiusLimit = this.saved.lower;
    this.camera.upperBetaLimit = this.saved.upper;
    this.camera.beta = Math.min(1.45, Math.max(0.45, this.saved.beta));
  }
}
