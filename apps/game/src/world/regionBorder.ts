import type { FlyController } from '../fly/FlyController.ts';
import type { PlayerController } from '../player/PlayerController.ts';
import { useGameStore } from '../state/store.ts';
import type { HeliSystem } from '../vehicles/helicopter/HeliSystem.ts';
import { applyBorder, borderPush } from './tiles/blockedRegions.ts';
import type { TileManager } from './tiles/TileManager.ts';

/**
 * Weiche Grenze vor gesperrten Nachladeregionen (Spec regional-streaming): Figur, Fahrzeuge, Flugmodus und
 * Hubschrauber werden 60 m vor einer nicht ladbaren Region abgebremst und sanft zurückgeschoben; die UI zeigt
 * dann einen Hinweis.
 */
export class RegionBorder {
  private edge = false;

  constructor(
    private readonly tiles: TileManager,
    private readonly tileSize: number,
    private readonly player: PlayerController,
    private readonly heli: HeliSystem,
    private readonly fly: () => FlyController | null,
  ) {}

  update(dtMs: number): void {
    const s = this.tileSize;
    const blocked = (tx: number, tz: number) => this.tiles.isBlocked((tx + 0.5) * s, (tz + 0.5) * s);
    const heli = this.heli.active;
    const fly = this.fly();
    const pos = heli ? heli.state : (fly?.position ?? this.player.position);
    const push = borderPush(pos.x, pos.z, blocked, s);
    this.setEdge(!!push);
    if (!push) return;
    if (heli) {
      const v = applyBorder(heli.state.vx, heli.state.vz, push);
      heli.state = { ...heli.state, ...v };
    } else if (fly) {
      fly.adjustVelocity((vx, vz) => applyBorder(vx, vz, push));
    } else if (this.player.vehicle) {
      const body = this.player.vehicle.sim.body;
      const lv = body.getLinearVelocity();
      const v = applyBorder(lv.x, lv.z, push);
      lv.x = v.vx;
      lv.z = v.vz;
      body.setLinearVelocity(lv);
    } else {
      // zu Fuß: Eingabe setzt die Geschwindigkeit jedes Bild neu -> Lage direkt nach außen schieben
      const p = this.player.walker.position;
      const step = 6 * push.strength * (Math.min(dtMs, 100) / 1000);
      p.x += push.nx * step;
      p.z += push.nz * step;
    }
  }

  private setEdge(v: boolean): void {
    if (v === this.edge) return;
    this.edge = v;
    useGameStore.getState().setRegionEdge(v);
  }
}
