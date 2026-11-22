import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { PhysicsRaycastResult } from '@babylonjs/core/Physics/physicsRaycastResult';
import type { PhysicsEngine } from '@babylonjs/core/Physics/v2/physicsEngine';
import type { Scene } from '@babylonjs/core/scene';
import type { PlayerController } from '../player/PlayerController.ts';
import type { TileManager } from '../world/tiles/TileManager.ts';
import { FlyController, type FlyFocus } from './FlyController.ts';
import type { FlightEnv } from './flyMath.ts';
import { firstFreeSpot } from './landing.ts';

const ray = new PhysicsRaycastResult();

/**
 * Ein Flug von „Fliegen“ bis „Zurück“ bzw. „Hier landen“: friert die Figur ein, steuert die Flugkamera und
 * setzt die Figur nach einer Landung an eine freie Stelle, sobald die Kollision der Zielkachel geladen ist.
 */
export class FlySession {
  private controller: FlyController | null;
  private pendingLand: { x: number; z: number } | null = null;

  constructor(
    private readonly scene: Scene,
    camera: ArcRotateCamera,
    private readonly tiles: TileManager,
    private readonly player: PlayerController,
    bounds: FlightEnv['bounds'],
  ) {
    player.suspend();
    this.controller = new FlyController(camera, (x, z) => tiles.heightAt(x, z), bounds);
  }

  /** Fliegt gerade (Kamera frei)? */
  get flying(): boolean {
    return this.controller !== null;
  }

  /** Noch etwas zu tun (Flug oder ausstehende Landung)? */
  get active(): boolean {
    return this.controller !== null || this.pendingLand !== null;
  }

  get controllerState(): FlyController | null {
    return this.controller;
  }

  update(dtMs: number): FlyFocus | null {
    return this.controller?.update(dtMs) ?? null;
  }

  /** „Zurück“: Kamera kehrt zur Figur zurück, die Figur bleibt an ihrer Stelle. */
  back(): void {
    this.end(null);
  }

  /** „Hier landen“: Figur auf den Boden unter der Flugkamera setzen. */
  land(): void {
    const c = this.controller;
    if (!c) return;
    const p = c.position;
    this.end({ x: p.x, z: p.z });
  }

  private end(land: { x: number; z: number } | null): void {
    this.controller?.dispose();
    this.controller = null;
    this.player.resume(land ?? undefined);
    this.pendingLand = land;
  }

  /**
   * Pro Bild vor dem Spieler-Update: liegt die Kollision am Landeplatz vor, wird geprüft, ob dort ein Gebäude
   * oder Fahrzeug steht, und die Figur notfalls an die nächste freie Stelle gesetzt.
   */
  checkLanding(): void {
    const l = this.pendingLand;
    if (!l || !this.tiles.isCollisionReady(l.x, l.z)) return;
    this.pendingLand = null;
    const engine = this.scene.getPhysicsEngine() as PhysicsEngine | null;
    const roofAt = (x: number, z: number): number | null => {
      if (!engine) return null;
      const g = this.tiles.heightAt(x, z);
      if (g === null) return null;
      engine.raycastToRef(new Vector3(x, g + 60, z), new Vector3(x, g - 1, z), ray);
      return ray.hasHit ? ray.hitPointWorld.y : null;
    };
    const spot = firstFreeSpot(l.x, l.z, (x, z) => this.tiles.heightAt(x, z), roofAt);
    if (spot.x !== l.x || spot.z !== l.z) this.player.teleport(spot.x, spot.z);
  }
}
