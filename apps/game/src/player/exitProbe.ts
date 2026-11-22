import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { PhysicsRaycastResult } from '@babylonjs/core/Physics/physicsRaycastResult';
import type { PhysicsEngine } from '@babylonjs/core/Physics/v2/physicsEngine';
import type { PhysicsBody } from '@babylonjs/core/Physics/v2/physicsBody';
import type { Scene } from '@babylonjs/core/scene';
import type { ExitCandidate } from './enterExit.ts';

const ray = new PhysicsRaycastResult();

/**
 * Prüft eine Absetzstelle per Raycasts: kein Hindernis zwischen Fahrzeug und Stelle (auf Hüft- und Kopfhöhe)
 * und Boden in Reichweite unter der Stelle.
 */
export function exitIsFree(
  scene: Scene,
  vehicleBody: PhysicsBody,
  from: Vector3,
  c: ExitCandidate,
  groundY: number | null,
): boolean {
  const engine = scene.getPhysicsEngine() as PhysicsEngine | null;
  if (!engine || groundY === null) return false;
  for (const h of [0.6, 1.5]) {
    const a = new Vector3(from.x, groundY + h, from.z);
    const b = new Vector3(c.x, groundY + h, c.z);
    engine.raycastToRef(a, b, ray, { ignoreBody: vehicleBody });
    if (ray.hasHit) return false;
  }
  const top = new Vector3(c.x, groundY + 2.2, c.z);
  engine.raycastToRef(top, new Vector3(c.x, groundY + 0.3, c.z), ray, { ignoreBody: vehicleBody });
  return !ray.hasHit; // nichts direkt über dem Boden (z. B. anderes Fahrzeug)
}
