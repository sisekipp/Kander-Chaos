import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateLineSystem } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import type { Scene } from '@babylonjs/core/scene';

/** Farben der Debug-Linien. */
export const DEBUG_COLORS = {
  rayHit: new Color4(0.2, 1, 0.3, 1),
  rayMiss: new Color4(1, 0.3, 0.3, 1),
  force: new Color4(1, 0.85, 0.2, 1),
  velocity: new Color4(0.3, 0.7, 1, 1),
} as const;

/**
 * Sammelt pro Bild Liniensegmente (Raycasts, Kräfte) und zeichnet sie als ein Linien-Mesh.
 * Ausgeschaltet kostet es nichts: `line()` kehrt sofort zurück.
 */
export class DebugLines {
  enabled = false;
  private lines: Vector3[][] = [];
  private colors: Color4[][] = [];
  private mesh: LinesMesh | null = null;
  private readonly obs;

  constructor(private readonly scene: Scene) {
    this.obs = scene.onAfterRenderObservable.add(() => this.flush());
  }

  line(from: Vector3, to: Vector3, color: Color4): void {
    if (!this.enabled) return;
    this.lines.push([from.clone(), to.clone()]);
    this.colors.push([color, color]);
  }

  /** Mesh für das nächste Bild aufbauen (nach dem Rendern, damit alle Segmente des Bildes drin sind). */
  private flush(): void {
    this.mesh?.dispose();
    this.mesh = null;
    if (this.enabled && this.lines.length) {
      this.mesh = CreateLineSystem('debug-lines', { lines: this.lines, colors: this.colors }, this.scene);
      this.mesh.isPickable = false;
      this.mesh.alwaysSelectAsActiveMesh = true;
    }
    this.lines = [];
    this.colors = [];
  }

  dispose(): void {
    this.scene.onAfterRenderObservable.remove(this.obs);
    this.mesh?.dispose();
  }
}
