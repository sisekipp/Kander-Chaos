import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { VehicleKind } from '@kandern/world-format';
import { getGame } from '../engine/gameInstance.ts';
import { getWorld } from '../world/worldInstance.ts';
import { buildVehicle } from './models/index.ts';
import { RaycastVehicle } from './physics/RaycastVehicle.ts';

/** Entwicklungs-Hilfe: setzt ein dynamisches Fahrzeug vor die Figur oder an eine feste Stelle. */
export function devSpawnVehicle(
  kind: VehicleKind,
  dist = 6,
  at?: { x: number; z: number; heading: number },
): RaycastVehicle | null {
  const game = getGame(),
    world = getWorld();
  if (!game || !world) return null;
  const p = world.player.position;
  const h = at?.heading ?? world.player.heading;
  const x = at?.x ?? p.x + Math.sin(h) * dist,
    z = at?.z ?? p.z + Math.cos(h) * dist;
  const pos = new Vector3(x, (world.tiles.heightAt(x, z) ?? p.y) + 1.2, z);
  const built = buildVehicle(game.scene, kind, Date.now());
  const v = new RaycastVehicle(game.scene, built.spec, built.model, pos, h);
  v.setDynamic(true);
  v.debug = world.debug;
  game.scene.onBeforePhysicsObservable.add(() => v.step(1 / 60));
  game.scene.onBeforeRenderObservable.add(() => v.updateVisuals());
  return v;
}
