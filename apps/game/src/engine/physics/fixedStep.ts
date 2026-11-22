import type { Scene } from '@babylonjs/core/scene';
import { clampAccumulator } from './stepping.ts';

export const PHYSICS_STEP_MS = 1000 / 60;
export const MAX_STEPS_PER_FRAME = 2;

interface SceneWithAccumulator {
  _physicsTimeAccumulator: number;
}

/**
 * Aktiviert feste Teilschritte (1/60 s, höchstens 2 pro Bild). Kräfte für Fahrzeuge werden je Teilschritt
 * in `scene.onBeforePhysicsObservable` angewendet. Gibt eine Abmelde-Funktion zurück.
 */
export function enableFixedPhysicsSteps(scene: Scene): () => void {
  const engine = scene.getPhysicsEngine();
  if (!engine) return () => {};
  engine.setSubTimeStep(PHYSICS_STEP_MS);
  const obs = scene.onBeforeRenderObservable.add(() => {
    const s = scene as unknown as SceneWithAccumulator;
    s._physicsTimeAccumulator = clampAccumulator(
      s._physicsTimeAccumulator ?? 0,
      scene.getEngine().getDeltaTime(),
      PHYSICS_STEP_MS,
      MAX_STEPS_PER_FRAME,
    );
  });
  // Beim Abmelden den Teilschritt NICHT zurücksetzen: die Physik-Engine wird geteilt (z. B. React StrictMode
  // startet die Welt doppelt) und eine zweite Welt verlässt sich weiter darauf.
  return () => scene.onBeforeRenderObservable.remove(obs);
}
