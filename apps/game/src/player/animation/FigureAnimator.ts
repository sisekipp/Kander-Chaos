import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { initialAnim, nextAnim, speedRatio, type AnimEvent, type AnimInput, type AnimState } from './animState.ts';
import { blendStep, type Weights } from './blend.ts';
import { isLooping, type ClipName } from './clips.ts';

/**
 * Babylon-Adapter: steuert die Animationsgruppen der Figur nach `animState` (Zustand) und `blend` (Gewichte).
 * Gruppen ohne Gewicht stehen still; einmalige Animationen starten beim Wechsel von vorn.
 */
export class FigureAnimator {
  private readonly groups = new Map<string, AnimationGroup>();
  state: AnimState = initialAnim();
  weights: Weights = { idle: 1 };
  private readonly playing = new Set<ClipName>();

  constructor(groups: AnimationGroup[]) {
    for (const g of groups) {
      g.stop();
      this.groups.set(g.name.split(':').pop() ?? g.name, g);
    }
    this.apply(0);
  }

  /** Aktuelle Animation (für UI-Tests und Debug). */
  get clip(): ClipName {
    return this.state.clip;
  }

  update(dt: number, input: AnimInput, event?: AnimEvent): void {
    const prev = this.state.clip;
    this.state = nextAnim(this.state, input, dt, event);
    // Einmalige Animation erneut ausgelöst (z. B. zweiter Sprung): von vorn
    if (event && prev === this.state.clip) this.restart(this.state.clip);
    this.weights = blendStep(this.weights, this.state.clip, dt);
    this.apply(input.speed);
  }

  private restart(clip: ClipName): void {
    this.groups.get(clip)?.stop();
    this.playing.delete(clip);
  }

  private apply(speed: number): void {
    for (const [name, g] of this.groups) {
      const clip = name as ClipName;
      const w = this.weights[clip] ?? 0;
      if (w <= 0) {
        if (this.playing.delete(clip)) g.stop();
        continue;
      }
      if (!this.playing.has(clip)) {
        g.weight = w;
        g.start(isLooping(clip), 1, g.from, g.to);
        this.playing.add(clip);
      }
      g.weight = w;
      g.speedRatio = speedRatio(clip, speed);
    }
  }

  dispose(): void {
    for (const g of this.groups.values()) g.dispose();
    this.groups.clear();
  }
}
