import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Scene } from '@babylonjs/core/scene';

/**
 * Partikel ohne Texturdateien (Design D10): eine einmal erzeugte weiche Kreistextur.
 * Feste Obergrenzen: höchstens 3 Dauer-Rauchsäulen gleichzeitig, je höchstens 60 Partikel;
 * in der Qualitätsstufe „Niedrig“ halbe Partikelzahl.
 */
export class Particles {
  private readonly texture: DynamicTexture;
  private readonly smokers = new Map<object, ParticleSystem>();
  private readonly bursts = new Set<ParticleSystem>();
  lowQuality = true;
  static readonly MAX_SMOKERS = 3;

  constructor(private readonly scene: Scene) {
    this.texture = new DynamicTexture('fx-soft', { width: 64, height: 64 }, scene, false);
    const ctx = this.texture.getContext() as CanvasRenderingContext2D;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    this.texture.update();
    this.texture.hasAlpha = true;
  }

  private scaled(n: number): number {
    return this.lowQuality ? Math.max(4, Math.round(n / 2)) : n;
  }

  /** Dauerhafter Rauch an einem Fahrzeug (dünn/dicht); `null` beendet ihn. */
  smoke(owner: object, emitter: AbstractMesh | null, thick: boolean | null): void {
    const cur = this.smokers.get(owner);
    if (thick === null || !emitter) {
      if (cur) {
        cur.stop();
        this.smokers.delete(owner);
        setTimeout(() => cur.dispose(), 3000);
      }
      return;
    }
    if (!cur && this.smokers.size >= Particles.MAX_SMOKERS) return;
    const ps = cur ?? new ParticleSystem('fx-smoke', this.scaled(60), this.scene);
    ps.particleTexture = this.texture;
    ps.emitter = emitter;
    ps.minEmitBox = new Vector3(-0.3, 0.4, 0.8);
    ps.maxEmitBox = new Vector3(0.3, 0.6, 1.2);
    const grey = thick ? 0.25 : 0.6;
    ps.color1 = new Color4(grey, grey, grey, thick ? 0.8 : 0.45);
    ps.color2 = new Color4(grey + 0.1, grey + 0.1, grey + 0.1, 0.3);
    ps.colorDead = new Color4(0.5, 0.5, 0.5, 0);
    ps.minSize = thick ? 0.6 : 0.3;
    ps.maxSize = thick ? 1.4 : 0.8;
    ps.minLifeTime = 0.8;
    ps.maxLifeTime = 1.8;
    ps.emitRate = this.scaled(thick ? 30 : 12);
    ps.direction1 = new Vector3(-0.3, 1.5, -0.3);
    ps.direction2 = new Vector3(0.3, 2.5, 0.3);
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    if (!cur) {
      ps.start();
      this.smokers.set(owner, ps);
    }
  }

  /** Kurzer Partikelstoß: „Puff“ (Rauchwolke) oder Funken/Konfetti-artige Splitter. */
  burst(at: Vector3, kind: 'puff' | 'sparks' | 'leaves', count = 40): void {
    const ps = new ParticleSystem(`fx-${kind}`, this.scaled(count), this.scene);
    ps.particleTexture = this.texture;
    ps.emitter = at.clone();
    ps.minEmitBox = new Vector3(-0.5, 0, -0.5);
    ps.maxEmitBox = new Vector3(0.5, 0.8, 0.5);
    if (kind === 'puff') {
      ps.color1 = new Color4(0.9, 0.9, 0.9, 0.9);
      ps.color2 = new Color4(0.7, 0.72, 0.75, 0.8);
      ps.minSize = 1;
      ps.maxSize = 2.4;
      ps.minEmitPower = 2;
      ps.maxEmitPower = 5;
    } else if (kind === 'sparks') {
      ps.color1 = new Color4(1, 0.85, 0.3, 1);
      ps.color2 = new Color4(1, 0.5, 0.2, 1);
      ps.minSize = 0.08;
      ps.maxSize = 0.18;
      ps.minEmitPower = 4;
      ps.maxEmitPower = 8;
      ps.gravity = new Vector3(0, -9.81, 0);
    } else {
      ps.color1 = new Color4(0.35, 0.6, 0.25, 1);
      ps.color2 = new Color4(0.45, 0.7, 0.3, 1);
      ps.minSize = 0.12;
      ps.maxSize = 0.3;
      ps.minEmitPower = 2;
      ps.maxEmitPower = 4;
      ps.gravity = new Vector3(0, -6, 0);
    }
    ps.colorDead = new Color4(0.6, 0.6, 0.6, 0);
    ps.direction1 = new Vector3(-1, 1, -1);
    ps.direction2 = new Vector3(1, 2.5, 1);
    ps.minLifeTime = 0.4;
    ps.maxLifeTime = 1.2;
    ps.manualEmitCount = ps.getCapacity();
    ps.targetStopDuration = 1.5;
    ps.disposeOnStop = true;
    ps.onDisposeObservable.addOnce(() => this.bursts.delete(ps));
    this.bursts.add(ps);
    ps.start();
  }

  get activeSmokers(): number {
    return this.smokers.size;
  }

  dispose(): void {
    for (const ps of this.smokers.values()) ps.dispose();
    for (const ps of this.bursts) ps.dispose();
    this.smokers.clear();
    this.bursts.clear();
    this.texture.dispose();
  }
}
