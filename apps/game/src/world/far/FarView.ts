import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import type { Scene } from '@babylonjs/core/scene';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Game } from '../../engine/Game.ts';
import { decodeFarTerrain, farHeightAt, type FarTerrain } from '@kandern/world-format';
import { farGrid, visibleSilhouettes, type SilhouetteSource } from './farSelect.ts';

/** Sichtweite im Flug: mindestens 12 km laut Spec; 20 km, damit Basel von Kandern aus (≈ 17 km) zu sehen ist. */
export const FAR_RANGE = 20000;

/**
 * Fernsicht im Flug (Spec world-streaming „Fernsicht“): grobes Gelände der ganzen Region knapp unter den
 * geladenen Kacheln und hohe Gebäude als Silhouetten (Thin Instances, ein Draw Call). Nur im Flug aktiv;
 * dann reicht die Sicht 20 km weit.
 */
export class FarView {
  private readonly terrain: Mesh | null;
  private readonly boxes: Mesh;
  private readonly list: SilhouetteSource[];
  private active = false;
  private sinceUpdate = 1e9;

  private constructor(
    scene: Scene,
    private readonly far: FarTerrain | null,
    list: SilhouetteSource[],
  ) {
    this.list = list;
    this.terrain = far ? FarView.terrainMesh(scene, far) : null;
    const mat = new StandardMaterial('far-sil', scene);
    mat.diffuseColor = new Color3(0.62, 0.64, 0.68);
    mat.specularColor = Color3.Black();
    this.boxes = CreateBox('far-silhouettes', { size: 1 }, scene);
    this.boxes.material = mat;
    this.boxes.isPickable = false;
    this.boxes.thinInstanceEnablePicking = false;
    this.boxes.setEnabled(false);
  }

  /** Lädt `farterrain.bin` und `skyline.json`; fehlt beides, gibt es keine Fernsicht (null). */
  static async load(scene: Scene, worldUrl: string): Promise<FarView | null> {
    const [far, sky] = await Promise.all([
      fetch(`${worldUrl}farterrain.bin`)
        .then(async (r) => (r.ok ? decodeFarTerrain(new Uint8Array(await r.arrayBuffer())) : null))
        .catch(() => null),
      fetch(`${worldUrl}skyline.json`)
        .then((r) => (r.ok ? (r.json() as Promise<{ buildings: SilhouetteSource[] }>) : null))
        .catch(() => null),
    ]);
    if (!far && !sky?.buildings.length) return null;
    return new FarView(scene, far, sky?.buildings ?? []);
  }

  private static terrainMesh(scene: Scene, far: FarTerrain): Mesh {
    const g = farGrid(far, 2);
    const colors = new Float32Array((g.positions.length / 3) * 4);
    for (let i = 0; i < g.heights.length; i++) {
      // tief = Wiesen/Felder, hoch = Wald
      const t = Math.min(1, Math.max(0, (g.heights[i] - 280) / 600));
      colors.set([0.45 - 0.2 * t, 0.62 - 0.18 * t, 0.36 - 0.12 * t, 1], i * 4);
    }
    const vd = new VertexData();
    vd.positions = g.positions;
    vd.indices = g.indices;
    vd.colors = colors;
    const normals: number[] = [];
    VertexData.ComputeNormals(g.positions, g.indices, normals);
    vd.normals = normals;
    const mesh = new Mesh('far-terrain', scene);
    vd.applyToMesh(mesh);
    const mat = new StandardMaterial('far-terrain', scene);
    mat.specularColor = Color3.Black();
    mesh.material = mat;
    mesh.hasVertexAlpha = false;
    mesh.isPickable = false;
    mesh.freezeWorldMatrix();
    mesh.setEnabled(false);
    return mesh;
  }

  get isActive(): boolean {
    return this.active;
  }

  get silhouetteCount(): number {
    return this.boxes.thinInstanceCount;
  }

  /** Im Flug einschalten, am Boden aus. */
  setActive(on: boolean): void {
    if (on === this.active) return;
    this.active = on;
    this.terrain?.setEnabled(on);
    this.boxes.setEnabled(on && this.boxes.thinInstanceCount > 0);
    this.sinceUpdate = 1e9;
  }

  /** Silhouetten etwa jede Sekunde neu wählen. `ringAt` = Detailstufe der geladenen Kachel an (x, z). */
  update(dtMs: number, x: number, z: number, ringAt: (x: number, z: number) => number | null): void {
    if (!this.active || !this.list.length) return;
    this.sinceUpdate += dtMs;
    if (this.sinceUpdate < 1000) return;
    this.sinceUpdate = 0;
    const pick = visibleSilhouettes(this.list, x, z, FAR_RANGE, ringAt);
    const m = new Float32Array(pick.length * 16);
    const tmp = new Matrix();
    pick.forEach((i, k) => {
      const e = this.list[i];
      const g = this.groundAt(e.x, e.z);
      Matrix.ScalingToRef(e.w, e.h, e.d, tmp);
      tmp.setTranslationFromFloats(e.x, g + e.h / 2, e.z);
      tmp.copyToArray(m, k * 16);
    });
    this.boxes.thinInstanceSetBuffer('matrix', m, 16, false);
    this.boxes.setEnabled(pick.length > 0);
  }

  /**
   * Pro Bild: im Flug (focus gesetzt) Fernsicht an, Sicht und Nebel auf 12 km, Hügel-Panorama aus;
   * am Boden zurück auf die Werte der Qualitätsstufe.
   */
  frame(
    dtMs: number,
    focus: { x: number; z: number } | null,
    ringAt: (x: number, z: number) => number | null,
    game: Game,
    panorama: AbstractMesh,
  ): void {
    const on = focus !== null;
    if (on !== this.active) {
      this.setActive(on);
      const q = game.quality;
      game.scene.fogStart = on ? FAR_RANGE * 0.35 : q.fogStart;
      game.scene.fogEnd = on ? FAR_RANGE : q.fogEnd;
      game.camera.maxZ = on ? FAR_RANGE + 500 : 2600;
      // größerer Nahbereich im Flug: genug Tiefenauflösung für 20 km
      game.camera.minZ = on ? 1 : 0.3;
      panorama.setEnabled(!on);
    }
    if (focus) this.update(dtMs, focus.x, focus.z, ringAt);
  }

  private groundAt(x: number, z: number): number {
    const f = this.far;
    if (!f) return 260;
    return farHeightAt(f, Math.round((x - f.minX) / f.step), Math.round((z - f.minZ) / f.step)) ?? 260;
  }

  dispose(): void {
    this.terrain?.dispose(false, true);
    this.boxes.dispose(false, true);
  }
}
