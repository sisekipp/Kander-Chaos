import type { Ring } from '../protocol.ts';

export interface UploadStep {
  tileId: string;
  ring: Ring;
  run: () => void;
}

/**
 * Zeitgestückelte Warteschlange für Szenen-Uploads (reine Logik, ohne Babylon).
 * Pro Bild werden Schritte abgearbeitet, bis das Zeitbudget verbraucht ist – mindestens einer,
 * damit es immer vorangeht. Ring-0-Schritte haben Vorrang.
 */
export class UploadQueue {
  private readonly steps: UploadStep[] = [];

  constructor(private readonly now: () => number = () => performance.now()) {}

  get length(): number {
    return this.steps.length;
  }

  push(step: UploadStep): void {
    this.steps.push(step);
  }

  has(tileId: string, ring: Ring): boolean {
    return this.steps.some((s) => s.tileId === tileId && s.ring === ring);
  }

  /** Verwirft alle Schritte einer Kachel. */
  drop(tileId: string): void {
    for (let i = this.steps.length - 1; i >= 0; i--) if (this.steps[i].tileId === tileId) this.steps.splice(i, 1);
  }

  /** Arbeitet innerhalb des Budgets ab; gibt die Zahl ausgeführter Schritte zurück. */
  process(budgetMs: number): number {
    const t0 = this.now();
    let n = 0;
    while (this.steps.length && (n === 0 || this.now() - t0 < budgetMs)) {
      let k = this.steps.findIndex((s) => s.ring === 0);
      if (k < 0) k = 0;
      const [step] = this.steps.splice(k, 1);
      step.run();
      n++;
    }
    return n;
  }

  clear(): void {
    this.steps.length = 0;
  }
}
