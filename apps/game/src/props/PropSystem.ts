import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { PropKind } from '@kandern/world-format';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { PhysicsBudget } from '../engine/physics/budget/index.ts';
import type { Particles } from '../engine/fx/particles.ts';
import { createVertexColorMaterial } from '../engine/procedural/PartKit.ts';
import type { TileState } from '../world/tiles/TileState.ts';
import { buildShapeMesh } from './models/index.ts';
import { PROP_SHAPE_COUNT, type PropShape } from './models/shapes.ts';
import { PropColliders } from './PropColliders.ts';
import { PropLayer, writeMatrix, type TileProps } from './PropLayer.ts';
import { spawnDebris, spawnReplacement, type SpawnContext } from './spawn.ts';
import { PROP_RULES, triggers } from './triggers.ts';
import type { GridProp } from './hitGrid.ts';

/** Etwas, das Kleinobjekte treffen kann (Figur oder dynamisches Fahrzeug). */
export interface PropActor {
  x: number;
  z: number;
  vx: number;
  vz: number;
  radius: number;
  /** Wird nach einem Treffer aufgerufen (Abbremsen, Fahrzeugschaden). */
  onHit?(kind: PropKind, kmh: number, slowdown: number): void;
}

/** Kleinobjekte: Laden (PropLayer), Treffer auslösen, Wiederaufbau, Collider im Nahbereich (Design D5). */
export class PropSystem {
  readonly layer: PropLayer;
  readonly colliders: PropColliders;
  private readonly tiles = new Map<string, TileProps>();
  private readonly bases: Mesh[] = [];
  private readonly propMaterial: StandardMaterial;
  private readonly ctx: SpawnContext;
  private readonly hits: GridProp[] = [];
  /** Ausgelöste Objekte insgesamt (für Tests/Anzeige). */
  triggered = 0;

  constructor(
    scene: Scene,
    budget: PhysicsBudget,
    private readonly fx: Particles,
    heightAt: (t: TileState, x: number, z: number) => number,
  ) {
    // Grundmodelle je Form (aus der Modell-Registry, sonst prozedural), ein gemeinsames Material
    const material = createVertexColorMaterial(scene, 'props-mat');
    this.propMaterial = material;
    for (let s = 0; s < PROP_SHAPE_COUNT; s++) this.bases.push(buildShapeMesh(scene, s as PropShape, material));
    this.ctx = { scene, budget, bases: this.bases, debrisMaterial: createVertexColorMaterial(scene, 'debris-mat') };
    this.colliders = new PropColliders(scene);
    this.layer = new PropLayer(scene, this.bases, heightAt, {
      ready: (p) => this.tiles.set(p.tileId, p),
      unload: (id) => this.tiles.delete(id), // Zustand verwerfen -> beim Neuladen steht alles wieder
    });
  }

  get tileCount(): number {
    return this.tiles.size;
  }

  allTiles(): IterableIterator<TileProps> {
    return this.tiles.values();
  }

  update(actors: PropActor[], px: number, pz: number, walking: boolean, now = performance.now()): void {
    for (const a of actors) {
      const speed = Math.hypot(a.vx, a.vz);
      if (speed < 1) continue;
      const kmh = speed * 3.6;
      for (const t of this.tiles.values()) {
        for (const g of t.grid.query(a.x, a.z, a.radius, this.hits)) {
          const p = t.props[g.index];
          if (t.rebuild.isDestroyed(p.index) || !triggers(p.kind, kmh)) continue;
          this.trigger(t, g.index, a.vx, a.vz, now);
          a.onHit?.(p.kind, kmh, PROP_RULES[p.kind].slowdown);
        }
      }
    }
    for (const t of this.tiles.values()) for (const i of t.rebuild.update(px, pz, now)) this.setVisible(t, i, true);
    this.colliders.update(this.tiles.values(), px, pz, walking);
  }

  /** Objekt auslösen: Instanz ausblenden, Ersatzkörper bzw. Trümmer erzeugen. */
  trigger(t: TileProps, index: number, vx: number, vz: number, now = performance.now()): void {
    const p = t.props[index];
    t.rebuild.markDestroyed(index, p.x, p.z, now);
    this.setVisible(t, index, false);
    this.colliders.remove(t.tileId, index);
    this.triggered++;
    if (PROP_RULES[p.kind].reaction === 'shatter') {
      spawnDebris(this.ctx, p, vx, vz);
      if (p.kind === PropKind.Bush) this.fx.burst(new Vector3(p.x, p.y + 0.6, p.z), 'leaves', 24);
    } else spawnReplacement(this.ctx, p, vx, vz);
  }

  private setVisible(t: TileProps, index: number, visible: boolean): void {
    const p = t.props[index];
    const m = t.matrices[p.shape],
      mesh = t.meshes[p.shape];
    if (!m || !mesh || mesh.isDisposed()) return;
    writeMatrix(m, p.slot, p, visible);
    mesh.thinInstanceBufferUpdated('matrix');
  }

  dispose(): void {
    this.colliders.dispose();
    for (const b of this.bases) b.dispose();
    this.propMaterial.dispose();
    this.ctx.debrisMaterial.dispose();
    this.tiles.clear();
  }
}
