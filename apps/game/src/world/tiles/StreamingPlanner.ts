import type { Ring } from '../protocol.ts';

export interface PlannerOptions {
  tileSize: number;
  /** Radius Ring 2 (Sichtgrenze) in m. */
  viewDistance: number;
  /** Harte Obergrenze gleichzeitig geladener Kacheln. */
  maxTiles: number;
  /** Hysterese an Kachelgrenzen in m. */
  hysteresis?: number;
  /** Ab dieser Geschwindigkeit (m/s) wird die Kachel in Fahrtrichtung vorgeladen. */
  lookAheadSpeed?: number;
}

export interface PlannedTile {
  id: string;
  tx: number;
  tz: number;
  ring: Ring;
  /** Kleiner = wichtiger. */
  priority: number;
}

/**
 * Entscheidet, welche Kachel in welcher Detailstufe geladen sein soll (reine Logik, testbar).
 * Ring 0 = 3x3 um die Ankerkachel, Ring 1 = 5x5, Ring 2 = bis zur Sichtweite.
 * Die Ankerkachel wechselt erst, wenn der Spieler sie um mehr als `hysteresis` verlassen hat.
 */
export class StreamingPlanner {
  private anchor: { tx: number; tz: number } | null = null;
  private readonly o: Required<PlannerOptions>;

  constructor(
    opts: PlannerOptions,
    private readonly exists: (tx: number, tz: number) => boolean,
  ) {
    this.o = { hysteresis: 30, lookAheadSpeed: 10, ...opts };
  }

  setViewDistance(d: number): void {
    this.o.viewDistance = d;
  }

  get anchorTile(): { tx: number; tz: number } | null {
    return this.anchor;
  }

  private updateAnchor(x: number, z: number): void {
    const s = this.o.tileSize;
    const tx = Math.floor(x / s),
      tz = Math.floor(z / s);
    if (!this.anchor) {
      this.anchor = { tx, tz };
      return;
    }
    const h = this.o.hysteresis;
    const ax0 = this.anchor.tx * s - h,
      ax1 = (this.anchor.tx + 1) * s + h;
    const az0 = this.anchor.tz * s - h,
      az1 = (this.anchor.tz + 1) * s + h;
    if (x < ax0 || x > ax1 || z < az0 || z > az1) this.anchor = { tx, tz };
  }

  plan(x: number, z: number, vx = 0, vz = 0): PlannedTile[] {
    this.updateAnchor(x, z);
    const { tx: ax, tz: az } = this.anchor!;
    const s = this.o.tileSize;
    const speed = Math.hypot(vx, vz);
    const dirX = speed > 0.5 ? vx / speed : 0,
      dirZ = speed > 0.5 ? vz / speed : 0;
    const r2 = Math.ceil(this.o.viewDistance / s);
    const out: PlannedTile[] = [];
    for (let dz = -r2; dz <= r2; dz++) {
      for (let dx = -r2; dx <= r2; dx++) {
        const tx = ax + dx,
          tz = az + dz;
        if (!this.exists(tx, tz)) continue;
        const cheb = Math.max(Math.abs(dx), Math.abs(dz));
        const cx = (tx + 0.5) * s - x,
          cz = (tz + 0.5) * s - z;
        const dist = Math.hypot(cx, cz);
        let ring: Ring;
        if (cheb <= 1) ring = 0;
        else if (cheb <= 2) ring = 1;
        else if (dist <= this.o.viewDistance) ring = 2;
        else continue;
        const cos = dist > 0 ? (cx * dirX + cz * dirZ) / dist : 0;
        const priority = ring * 100000 + dist * (1 - 0.5 * cos);
        out.push({ id: `${tx},${tz}`, tx, tz, ring, priority });
      }
    }
    // Vorausladen: bei schneller Fahrt die übernächste Kachel in Fahrtrichtung schon in Ring 0
    if (speed >= this.o.lookAheadSpeed) {
      const lx = Math.floor((x + dirX * s * 1.5) / s),
        lz = Math.floor((z + dirZ * s * 1.5) / s);
      for (const t of out) {
        if (
          Math.abs(t.tx - lx) <= 1 &&
          Math.abs(t.tz - lz) <= 1 &&
          t.ring > 0 &&
          Math.max(Math.abs(t.tx - ax), Math.abs(t.tz - az)) <= 2
        ) {
          t.ring = 0;
          t.priority = 50000 + (t.priority % 100000);
        }
      }
    }
    out.sort((a, b) => a.priority - b.priority || (a.id < b.id ? -1 : 1));
    return out.slice(0, this.o.maxTiles);
  }
}
