import type { Scene } from '@babylonjs/core/scene';
import { getGame } from '../engine/gameInstance.ts';
import { useGameStore } from '../state/store.ts';
import { ModelRegistry, getModels, setModels } from './ModelRegistry.ts';

let pending: { scene: Scene; promise: Promise<ModelRegistry> } | null = null;
let loadedFor: Scene | null = null;

/**
 * Lädt alle Modelle einmal in die aktuelle Szene (Fortschritt im Store). Weitere Aufrufe teilen sich den
 * Vorgang. Wurde die Szene neu angelegt (React StrictMode in der Entwicklung), wird neu geladen.
 */
export function loadModelsOnce(): Promise<ModelRegistry> {
  const game = getGame();
  if (!game) return Promise.reject(new Error('Spiel noch nicht gestartet'));
  const scene = game.scene;
  const existing = getModels();
  if (existing && loadedFor === scene) return Promise.resolve(existing);
  if (pending && pending.scene === scene) return pending.promise;
  const setModelsState = useGameStore.getState().setModels;
  setModelsState({ ready: false, error: '', loaded: 0 });
  const promise = ModelRegistry.load(scene, (loaded, total) => {
    if (pending?.scene === scene) setModelsState({ loaded, total });
  })
    .then((r) => {
      if (scene.isDisposed) throw new Error('Szene verworfen');
      setModels(r);
      loadedFor = scene;
      setModelsState({ ready: true, error: '' });
      return r;
    })
    .catch((e: Error) => {
      if (pending?.scene === scene) {
        pending = null;
        // Szene inzwischen ersetzt: mit der neuen Szene weitermachen statt Fehler zu melden
        const now = getGame()?.scene;
        if (now && now !== scene) return loadModelsOnce();
        setModelsState({ error: e.message });
      }
      throw e;
    });
  pending = { scene, promise };
  return promise;
}
