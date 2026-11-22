import type { AssetContainer } from '@babylonjs/core/assetContainer';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import '@babylonjs/loaders/glTF/glTFFileLoader';
import '@babylonjs/loaders/glTF/2.0/glTFLoader';
import '@babylonjs/loaders/glTF/2.0/Extensions/EXT_meshopt_compression';
import '@babylonjs/loaders/glTF/2.0/Extensions/KHR_mesh_quantization';
import { BASE_URL } from '../engine/assets.ts';
import { configureMeshopt } from './meshopt.ts';
import { parseManifest, type ModelEntry, type ModelManifest } from './manifest.ts';

/** Vorlage für Thin Instances: eigene Geometrie-Kopie je Teil-Mesh (Instanzpuffer hängen an der Geometrie). */
export interface InstanceTemplate {
  name: string;
  vertexData: VertexData;
  materialName: string;
}

/**
 * Lädt beim Start alle Modelle aus dem Manifest einmal als AssetContainer und gibt Vorlagen heraus:
 * - `instantiate(id)`: Kopie in der Szene (Fahrzeuge, animierte Figuren), eigene Knoten je Aufruf
 * - `instanceTemplates(id)`: Geometrie je Teil-Mesh für Thin Instances (Props)
 */
export class ModelRegistry {
  private constructor(
    readonly manifest: ModelManifest,
    private readonly containers: Map<string, AssetContainer>,
  ) {}

  static async load(
    scene: Scene,
    onProgress?: (loaded: number, total: number) => void,
    base = `${BASE_URL}models/`,
  ): Promise<ModelRegistry> {
    configureMeshopt();
    const res = await fetch(`${base}manifest.json`);
    if (!res.ok) throw new Error(`Modell-Manifest nicht gefunden (HTTP ${res.status})`);
    const manifest = parseManifest(await res.json());
    const containers = new Map<string, AssetContainer>();
    let loaded = 0;
    onProgress?.(0, manifest.models.length);
    await Promise.all(
      manifest.models.map(async (e) => {
        const c = await LoadAssetContainerAsync(`${base}${e.file}`, scene, { pluginExtension: '.glb' });
        containers.set(e.id, c);
        onProgress?.(++loaded, manifest.models.length);
      }),
    );
    return new ModelRegistry(manifest, containers);
  }

  get ids(): string[] {
    return this.manifest.models.map((m) => m.id);
  }

  entry(id: string): ModelEntry {
    const e = this.manifest.models.find((m) => m.id === id);
    if (!e) throw new Error(`Modell "${id}" nicht im Manifest`);
    return e;
  }

  /** Kopie eines Modells in der Szene (Materialien geklont, damit Farbzonen je Kopie gesetzt werden können). */
  instantiate(id: string, name = id) {
    const c = this.containers.get(id);
    if (!c) throw new Error(`Modell "${id}" nicht geladen`);
    return c.instantiateModelsToScene((n) => `${name}:${n}`, true, { doNotInstantiate: true });
  }

  /** Geometrie aller Teil-Meshes eines Modells in Modellkoordinaten (für Thin Instances). */
  instanceTemplates(id: string): InstanceTemplate[] {
    const c = this.containers.get(id);
    if (!c) throw new Error(`Modell "${id}" nicht geladen`);
    return c.meshes
      .filter((m): m is Mesh => m.getTotalVertices() > 0)
      .map((m) => {
        m.computeWorldMatrix(true);
        const vd = VertexData.ExtractFromMesh(m, true, true);
        vd.transform(m.getWorldMatrix());
        return { name: m.name, vertexData: vd, materialName: m.material?.name ?? '' };
      });
  }

  dispose(): void {
    for (const c of this.containers.values()) c.dispose();
    this.containers.clear();
  }
}

let instance: ModelRegistry | null = null;
export const getModels = (): ModelRegistry | null => instance;
export const setModels = (r: ModelRegistry | null): void => {
  instance = r;
};
