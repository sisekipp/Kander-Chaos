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
import type { RemoteFiles } from '../offline/remoteFiles.ts';

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
  /** Modelle der Region (`manifest-remote.json`): werden erst bei Bedarf über `ensure` geladen. */
  private remote = new Map<string, ModelEntry>();
  private files: RemoteFiles | null = null;
  private readonly listeners = new Set<(id: string) => void>();

  private constructor(
    readonly manifest: ModelManifest,
    private readonly containers: Map<string, AssetContainer>,
    private readonly scene?: Scene,
  ) {}

  /** Regionsmodelle bekannt machen; die Bytes kommen über `files` (Region-Cache oder Netz). */
  attachRemote(entries: ModelEntry[], files: RemoteFiles): void {
    this.remote = new Map(entries.map((e) => [e.id, e]));
    this.files = files;
    const byFile = new Map(entries.map((e) => [e.file, e]));
    files.onLoaded = (file, data) => {
      const e = byFile.get(file);
      if (!e || !data || !this.scene) return;
      files.take(file);
      const url = URL.createObjectURL(new Blob([data], { type: 'model/gltf-binary' }));
      void LoadAssetContainerAsync(url, this.scene, { pluginExtension: '.glb' })
        .then((c) => {
          this.containers.set(e.id, c);
          for (const fn of this.listeners) fn(e.id);
        })
        .catch((err) => console.warn('[models]', e.id, err))
        .finally(() => URL.revokeObjectURL(url));
    };
  }

  /** Ist das Modell geladen (Kern oder bereits nachgeladene Region)? */
  isLoaded(id: string): boolean {
    return this.containers.has(id);
  }

  /** Gibt es das Modell überhaupt (Kern oder Region)? */
  knows(id: string): boolean {
    return this.containers.has(id) || this.remote.has(id);
  }

  /** Regionsmodell anfordern (kleinere Priorität = wichtiger); true, wenn es schon geladen ist. */
  ensure(id: string, prio = 0): boolean {
    if (this.containers.has(id)) return true;
    const e = this.remote.get(id);
    if (e && this.files) this.files.request({ file: e.file, sha256: e.sha256 ?? '', bytes: e.bytes }, prio);
    return false;
  }

  /** Benachrichtigung, sobald ein Regionsmodell geladen ist; liefert die Abmeldung. */
  onReady(fn: (id: string) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

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
    return new ModelRegistry(manifest, containers, scene);
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
