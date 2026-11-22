import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { BuiltTile, Ring } from '../protocol.ts';

/** Zustand einer geladenen (oder gerade hochgeladenen) Kachel in der Szene. */
export class TileState {
  readonly id: string;
  readonly ring: Ring;
  readonly tx: number;
  readonly tz: number;
  readonly size: number;
  /** Elternknoten der Kachel-Meshes (Kachel-lokale Koordinaten). */
  readonly root: TransformNode;
  /** Meshes, die mit der Kachel sichtbar werden und beim Entladen freigegeben werden. */
  readonly meshes: Mesh[] = [];
  /** Höhenraster LOD0 in Metern (nur Ring 0). */
  readonly heightfield: { samples: number; heights: Float32Array } | null;
  /** Kollision dieser Kachel steht (Ring 0 mit Physik). */
  hasCollision = false;
  /** Freie Ablage für Layer (z. B. Physikkörper, Instanzpuffer). */
  readonly data = new Map<string, unknown>();
  private readonly disposers: (() => void)[] = [];

  constructor(scene: Scene, built: BuiltTile) {
    this.id = built.tileId;
    this.ring = built.ring;
    this.tx = built.tx;
    this.tz = built.tz;
    this.size = built.size;
    this.heightfield = built.heightfield
      ? { samples: built.heightfield.samples, heights: built.heightfield.heights.slice() }
      : null;
    this.root = new TransformNode(`tile-${built.tileId}-r${built.ring}`, scene);
    this.root.position.set(built.tx * built.size, 0, built.tz * built.size);
    this.root.computeWorldMatrix(true); // vor dem Einfrieren der Kinder, sonst landen alle Kacheln am Ursprung
    this.root.freezeWorldMatrix();
    this.root.setEnabled(false);
  }

  /** Weltposition der südwestlichen Kachelecke. */
  get originX(): number {
    return this.tx * this.size;
  }

  get originZ(): number {
    return this.tz * this.size;
  }

  onDispose(fn: () => void): void {
    this.disposers.push(fn);
  }

  /** Macht die Kachel sichtbar und friert die Weltmatrizen ein. */
  show(): void {
    this.root.setEnabled(true);
    for (const m of this.meshes) {
      m.setEnabled(true);
      m.computeWorldMatrix(true);
      m.freezeWorldMatrix();
    }
  }

  /** Bilineare Geländehöhe aus dem Höhenraster (Weltkoordinaten) oder null. */
  heightAt(x: number, z: number): number | null {
    const hf = this.heightfield;
    if (!hf) return null;
    const n = hf.samples - 1;
    const fx = Math.min(n, Math.max(0, ((x - this.originX) / this.size) * n));
    const fz = Math.min(n, Math.max(0, ((z - this.originZ) / this.size) * n));
    const i0 = Math.min(Math.floor(fx), n - 1),
      j0 = Math.min(Math.floor(fz), n - 1);
    const ax = fx - i0,
      az = fz - j0,
      w = hf.samples,
      h = hf.heights;
    const k = j0 * w + i0;
    return (h[k] * (1 - ax) + h[k + 1] * ax) * (1 - az) + (h[k + w] * (1 - ax) + h[k + w + 1] * ax) * az;
  }

  dispose(): void {
    for (let i = this.disposers.length - 1; i >= 0; i--) this.disposers[i]();
    this.disposers.length = 0;
    for (const m of this.meshes) m.dispose(false, false);
    this.meshes.length = 0;
    this.root.dispose();
  }
}
