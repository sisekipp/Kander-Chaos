/** Folgt einer Wegpunktliste mit konstanter Geschwindigkeit (für reproduzierbare Messfahrten). */
export class RouteFollower {
  private seg = 0;
  private t = 0;
  done = false;

  constructor(
    private readonly points: [number, number][],
    private readonly speed: number,
  ) {}

  /** Neue Position nach dt Sekunden. */
  step(dt: number): { x: number; z: number; vx: number; vz: number } {
    let remaining = this.speed * dt;
    while (!this.done) {
      const [x0, z0] = this.points[this.seg];
      const [x1, z1] = this.points[this.seg + 1];
      const len = Math.hypot(x1 - x0, z1 - z0);
      const left = len * (1 - this.t);
      if (remaining < left || len === 0) {
        this.t += len > 0 ? remaining / len : 1;
        const x = x0 + (x1 - x0) * this.t,
          z = z0 + (z1 - z0) * this.t;
        return {
          x,
          z,
          vx: len > 0 ? ((x1 - x0) / len) * this.speed : 0,
          vz: len > 0 ? ((z1 - z0) / len) * this.speed : 0,
        };
      }
      remaining -= left;
      this.seg++;
      this.t = 0;
      if (this.seg >= this.points.length - 1) this.done = true;
    }
    const [x, z] = this.points[this.points.length - 1];
    return { x, z, vx: 0, vz: 0 };
  }

  get progress(): number {
    return Math.min(1, (this.seg + this.t) / Math.max(1, this.points.length - 1));
  }
}
