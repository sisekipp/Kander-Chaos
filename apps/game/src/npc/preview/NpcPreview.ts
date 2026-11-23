import { BakedVertexAnimationManager } from '@babylonjs/core/BakedVertexAnimation/bakedVertexAnimationManager';
import { Constants } from '@babylonjs/core/Engines/constants';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Matrix } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import type { Observer } from '@babylonjs/core/Misc/observable';
import type { Scene } from '@babylonjs/core/scene';
import type { ModelRegistry } from '../../assets/ModelRegistry.ts';
import { createVertexColorMaterial } from '../../engine/procedural/PartKit.ts';
import { previewLayout, vatSettings } from './layout.ts';

const BASE_URL = import.meta.env.BASE_URL;

/**
 * Testansicht der NPC-Figuren (Design D6): alle Figurmodelle nebeneinander, Animationen aus der gebackenen
 * Animationstextur (VAT) per Babylon `BakedVertexAnimationManager`, je Modell ein Mesh mit Thin Instances –
 * ein Draw Call je Figurmodell, keine Skelettberechnung auf der CPU.
 */
export class NpcPreview {
  readonly meshes: Mesh[] = [];
  private readonly textures: RawTexture[] = [];
  private readonly managers: BakedVertexAnimationManager[] = [];
  private observer: Observer<Scene> | null = null;

  private constructor(
    private readonly scene: Scene,
    readonly root: TransformNode,
  ) {}

  /** Baut die Ansicht vor (x, y, z) mit Blick zur Richtung `yaw` + 180° (zur Kamera hin). */
  static async create(scene: Scene, registry: ModelRegistry, at: { x: number; y: number; z: number; yaw: number }) {
    const ids = registry.ids.filter((id) => registry.entry(id).kind === 'npc' && registry.entry(id).vat);
    const root = new TransformNode('npc-preview', scene);
    root.position.set(at.x, at.y, at.z);
    root.rotation.y = at.yaw + Math.PI;
    const preview = new NpcPreview(scene, root);
    const material = createVertexColorMaterial(scene, 'npc-preview-mat');
    const slots = previewLayout(ids);
    await Promise.all(
      ids.map(async (id) => {
        const vat = registry.entry(id).vat!;
        const res = await fetch(`${BASE_URL}models/${vat.file}`);
        if (!res.ok) throw new Error(`Animationstextur ${vat.file} fehlt (HTTP ${res.status})`);
        const data = new Uint16Array(await res.arrayBuffer());
        const tex = new RawTexture(
          data,
          vat.width,
          vat.height,
          Constants.TEXTUREFORMAT_RGBA,
          scene,
          false,
          false,
          Constants.TEXTURE_NEAREST_SAMPLINGMODE,
          Constants.TEXTURETYPE_HALF_FLOAT,
        );
        const manager = new BakedVertexAnimationManager(scene);
        manager.texture = tex;
        preview.textures.push(tex);
        preview.managers.push(manager);
        const inst = registry.instantiate(id, `npc-${id}`);
        for (const n of inst.rootNodes) n.parent = root;
        const mesh = inst.rootNodes
          .flatMap((n) => n.getChildMeshes(false))
          .find((m) => m.getTotalVertices() > 0 && m.skeleton) as Mesh | undefined;
        if (!mesh) throw new Error(`NPC ${id}: kein Mesh mit Skelett`);
        mesh.material?.dispose();
        mesh.material = material;
        mesh.hasVertexAlpha = false;
        mesh.isPickable = false;
        mesh.bakedVertexAnimationManager = manager;
        // Plätze dieses Modells: Lage im glTF-Raum des Modells (der Wurzelknoten spiegelt x)
        const mine = slots.filter((s) => s.model === id);
        const matrices = new Float32Array(mine.length * 16);
        const settings = new Float32Array(mine.length * 4);
        mine.forEach((s, k) => {
          Matrix.Translation(-s.x, 0, -s.z).copyToArray(matrices, k * 16);
          settings.set(vatSettings(vat, s.clip, k + ids.indexOf(id)), k * 4);
        });
        mesh.thinInstanceSetBuffer('matrix', matrices, 16);
        mesh.thinInstanceSetBuffer('bakedVertexAnimationSettingsInstanced', settings, 4);
        mesh.alwaysSelectAsActiveMesh = true;
        preview.meshes.push(mesh);
      }),
    );
    preview.observer = scene.onBeforeRenderObservable.add(() => {
      const dt = scene.getEngine().getDeltaTime() / 1000;
      for (const m of preview.managers) m.time += dt;
    });
    return preview;
  }

  /** Anzahl der Figuren (Thin Instances über alle Modelle). */
  get count(): number {
    return this.meshes.reduce((s, m) => s + m.thinInstanceCount, 0);
  }

  dispose(): void {
    if (this.observer) this.scene.onBeforeRenderObservable.remove(this.observer);
    this.root.dispose(false, true);
    for (const m of this.managers) m.dispose(false);
    for (const t of this.textures) t.dispose();
  }
}

let current: NpcPreview | null = null;
export const getNpcPreview = (): NpcPreview | null => current;

/** Testansicht ein-/ausschalten (Knopf „NPCs“ im Testmodus). */
export async function toggleNpcPreview(
  scene: Scene,
  registry: ModelRegistry | null,
  at: { x: number; y: number; z: number; yaw: number },
): Promise<boolean> {
  if (current) {
    current.dispose();
    current = null;
    return false;
  }
  if (!registry) return false;
  current = await NpcPreview.create(scene, registry, at);
  return true;
}

export function disposeNpcPreview(): void {
  current?.dispose();
  current = null;
}
