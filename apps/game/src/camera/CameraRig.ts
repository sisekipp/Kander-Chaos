import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { input } from '../player/input.ts';
import { cameraForwardYaw, chaseAlpha, smoothFactor, zoomForSpeed } from './followMath.ts';

export type CameraMode = 'walk' | 'chase';

/**
 * Steuert die ArcRotateCamera: zu Fuß frei drehbar per Wischen, beim Fahren hinter dem Fahrzeug
 * (Zoom nach Tempo, schwenkt nach dem Loslassen zurück).
 */
export class CameraRig {
  mode: CameraMode = 'walk';
  private idle = 0;
  private walkRadius = 9;

  constructor(private readonly camera: ArcRotateCamera) {
    camera.radius = this.walkRadius;
    camera.beta = 1.2;
  }

  /** Blickrichtung der Kamera als Gierwinkel (für kamerarelative Bewegung zu Fuß). */
  get forwardYaw(): number {
    return cameraForwardYaw(this.camera.alpha);
  }

  setMode(mode: CameraMode): void {
    if (mode === this.mode) return;
    if (mode === 'chase') this.walkRadius = this.camera.radius;
    else this.camera.radius = this.walkRadius;
    this.mode = mode;
    this.idle = 0;
  }

  /** Ziel sofort setzen (z. B. nach Teleport), ohne Abstand und Winkel neu zu berechnen. */
  jumpTo(target: Vector3): void {
    this.camera.setTarget(target.clone(), false, false, true);
  }

  update(dtMs: number, target: Vector3, heading: number, speed: number): void {
    const dt = Math.min(dtMs, 100) / 1000;
    const swiping = input.lookDX !== 0 || input.lookDY !== 0;
    this.camera.alpha -= input.lookDX;
    this.camera.beta = Math.min(1.45, Math.max(0.45, this.camera.beta - input.lookDY));
    input.lookDX = 0;
    input.lookDY = 0;
    this.idle = swiping ? 0 : this.idle + dt;
    if (this.mode === 'chase') {
      this.camera.alpha = chaseAlpha(this.camera.alpha, heading, dt, this.idle);
      this.camera.radius += (zoomForSpeed(speed) - this.camera.radius) * smoothFactor(2, dt);
    }
    const f = smoothFactor(this.mode === 'chase' ? 14 : 12, dt);
    this.camera.setTarget(Vector3.Lerp(this.camera.target, target, f), false, false, true);
  }
}
