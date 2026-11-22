import { HavokPlugin } from '@babylonjs/core/Physics/v2/Plugins/havokPlugin';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import '@babylonjs/core/Physics/joinedPhysicsEngineComponent';
import type { Scene } from '@babylonjs/core/scene';
import HavokPhysics from '@babylonjs/havok';
import { LOCAL_ASSETS } from '../assets.ts';

export interface PhysicsInit {
  plugin: HavokPlugin;
  /** Dauer von WASM-Laden + Instanziieren in ms (Spike-Messwert). */
  wasmStartMs: number;
}

let havokPromise: Promise<unknown> | null = null;
let wasmStartMs = 0;

/** Lädt Havok einmalig aus der lokal gebündelten WASM-Datei (kein CDN). */
function loadHavok(): Promise<unknown> {
  if (!havokPromise) {
    const t0 = performance.now();
    havokPromise = HavokPhysics({ locateFile: () => LOCAL_ASSETS.havokWasm }).then((h) => {
      wasmStartMs = performance.now() - t0;
      return h;
    });
  }
  return havokPromise;
}

const users = new WeakMap<Scene, { count: number; plugin: HavokPlugin }>();

/**
 * Aktiviert Havok-Physik in der Szene (mit Referenzzählung: mehrere Nutzer teilen sich die Engine,
 * z. B. wenn React im StrictMode Effekte doppelt ausführt).
 */
export async function enableHavok(scene: Scene): Promise<PhysicsInit> {
  const hk = await loadHavok();
  const u = users.get(scene);
  if (u && scene.isPhysicsEnabled()) {
    u.count++;
    return { plugin: u.plugin, wasmStartMs };
  }
  const plugin = new HavokPlugin(true, hk);
  scene.enablePhysics(new Vector3(0, -9.81, 0), plugin);
  users.set(scene, { count: 1, plugin });
  return { plugin, wasmStartMs };
}

/** Gibt die Physik frei; deaktiviert sie, wenn kein Nutzer mehr übrig ist. */
export function releaseHavok(scene: Scene): void {
  const u = users.get(scene);
  if (!u) return;
  u.count--;
  if (u.count <= 0) {
    users.delete(scene);
    if (scene.isPhysicsEnabled()) scene.disablePhysicsEngine();
  }
}
