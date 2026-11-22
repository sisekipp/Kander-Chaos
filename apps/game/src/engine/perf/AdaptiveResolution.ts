export interface AdaptiveResolutionOptions {
  base: number;
  min: number;
  /** Unter dieser Bildrate wird abgesenkt. */
  lowFps?: number;
  /** So lange muss die Bildrate darunter liegen (ms). */
  lowWindowMs?: number;
  /** Schrittweite der Absenkung. */
  step?: number;
  /** Über dieser Bildrate wird nach `highWindowMs` wieder angehoben (bis `base`). */
  highFps?: number;
  highWindowMs?: number;
}

/**
 * Regel für die adaptive Auflösung (reine Logik, ohne Engine -> testbar):
 * Liegt die Bildrate länger als 3 s unter 28 fps, wird die Renderauflösung um einen Schritt
 * gesenkt, bis zur Untergrenze. Ist sie lange stabil hoch, wird vorsichtig wieder angehoben.
 */
export class AdaptiveResolution {
  scale: number;
  private lowMs = 0;
  private highMs = 0;
  private readonly o: Required<AdaptiveResolutionOptions>;

  constructor(opts: AdaptiveResolutionOptions) {
    this.o = { lowFps: 28, lowWindowMs: 3000, step: 0.05, highFps: 45, highWindowMs: 10000, ...opts };
    this.scale = opts.base;
  }

  reset(base: number, min: number): void {
    this.o.base = base;
    this.o.min = min;
    this.scale = base;
    this.lowMs = 0;
    this.highMs = 0;
  }

  /** Mit gemessener Bildzeit pro Bild aufrufen. Gibt true zurück, wenn sich `scale` geändert hat. */
  update(frameMs: number): boolean {
    const fps = 1000 / Math.max(frameMs, 0.001);
    // Ausreißer (Tab im Hintergrund, Ladehänger) nicht als Dauerlast werten
    if (frameMs > 500) return false;
    if (fps < this.o.lowFps) {
      this.lowMs += frameMs;
      this.highMs = 0;
    } else if (fps > this.o.highFps) {
      this.highMs += frameMs;
      this.lowMs = Math.max(0, this.lowMs - frameMs);
    } else {
      this.lowMs = Math.max(0, this.lowMs - frameMs);
      this.highMs = 0;
    }
    if (this.lowMs >= this.o.lowWindowMs && this.scale > this.o.min + 1e-6) {
      this.scale = Math.max(this.o.min, round2(this.scale - this.o.step));
      this.lowMs = 0;
      return true;
    }
    if (this.highMs >= this.o.highWindowMs && this.scale < this.o.base - 1e-6) {
      this.scale = Math.min(this.o.base, round2(this.scale + this.o.step));
      this.highMs = 0;
      return true;
    }
    return false;
  }
}

const round2 = (v: number) => Math.round(v * 100) / 100;
