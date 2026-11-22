import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { PlayerController } from '../player/PlayerController.ts';
import type { PropActor } from '../props/PropSystem.ts';
import type { VehicleManager } from '../vehicles/VehicleManager.ts';

/**
 * Sammelt alles, was Kleinobjekte treffen kann: die Figur zu Fuß und alle dynamischen Fahrzeuge.
 * Fahrzeuge werden beim Treffer leicht abgebremst und nehmen etwas Schaden (max. 2 % je Objekt).
 */
export function collectPropActors(player: PlayerController, vehicles: VehicleManager | null): PropActor[] {
  const actors: PropActor[] = [];
  if (player.state.kind === 'walking') {
    const p = player.walker.position,
      v = player.walker.velocity;
    actors.push({ x: p.x, z: p.z, vx: v.x, vz: v.z, radius: 0.4 });
  }
  if (!vehicles) return actors;
  for (const veh of vehicles.all()) {
    if (!veh.sim.isDynamic || veh.wrecked) continue;
    const v = veh.sim.velocity;
    const [w, , l] = veh.sim.spec.box;
    actors.push({
      x: veh.position.x,
      z: veh.position.z,
      vx: v.x,
      vz: v.z,
      radius: Math.max(w, l) * 0.45,
      onHit: (_kind, kmh, slowdown) => {
        const cur = veh.sim.velocity;
        veh.sim.body.setLinearVelocity(new Vector3(cur.x * (1 - slowdown), cur.y, cur.z * (1 - slowdown)));
        vehicles.damageOf(veh)?.applyHit(kmh, 'prop', veh.position);
      },
    });
  }
  return actors;
}
