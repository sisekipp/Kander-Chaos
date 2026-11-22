import { RoadKind, pointInRing, type TileData } from '@kandern/world-format';

/** Straßenarten mit Fahrbahn für Kraftfahrzeuge (Props dürfen dort nie stehen). */
export const isCarriageway = (k: RoadKind): boolean => k <= RoadKind.Service;

/**
 * Belegungsraster (0,5 m) für eine Kachel plus Rand in Weltkoordinaten. Markiert Fahrbahnen,
 * Wege und Gebäude der Kachel und ihrer Nachbarn, damit auch Straßen jenseits der Kachelgrenze
 * berücksichtigt werden. Gesetzte Props werden ebenfalls eingetragen (kein Übereinanderstellen).
 */
export class ConflictMap {
  private readonly cell = 0.5;
  private readonly n: number;
  private readonly x0: number;
  private readonly z0: number;
  /** 0 frei, 1 Weg (nur blockiert für Props, die nicht am Wegrand stehen dürfen), 2 belegt */
  private readonly grid: Uint8Array;

  constructor(
    readonly tx: number,
    readonly tz: number,
    readonly size: number,
    margin = 12,
  ) {
    this.x0 = tx * size - margin;
    this.z0 = tz * size - margin;
    this.n = Math.ceil((size + 2 * margin) / this.cell);
    this.grid = new Uint8Array(this.n * this.n);
  }

  private idx(x: number, z: number): number {
    const i = Math.floor((x - this.x0) / this.cell),
      j = Math.floor((z - this.z0) / this.cell);
    return i < 0 || j < 0 || i >= this.n || j >= this.n ? -1 : j * this.n + i;
  }

  private mark(x: number, z: number, v: number): void {
    const k = this.idx(x, z);
    if (k >= 0 && this.grid[k] < v) this.grid[k] = v;
  }

  /** Abtastpunkte einer Kreisscheibe: symmetrisches Raster inkl. Mittelpunkt. */
  private *disc(r: number): Generator<[number, number]> {
    const m = Math.ceil(r / this.cell);
    const lim = (r + this.cell / 2) ** 2;
    for (let b = -m; b <= m; b++)
      for (let a = -m; a <= m; a++) {
        const dx = a * this.cell,
          dz = b * this.cell;
        if (dx * dx + dz * dz <= lim) yield [dx, dz];
      }
  }

  /** Kreisscheibe belegen. */
  fillCircle(x: number, z: number, r: number, v = 2): void {
    for (const [dx, dz] of this.disc(r)) this.mark(x + dx, z + dz, v);
  }

  /** Straßen/Wege und Gebäude einer (Nachbar-)Kachel eintragen. */
  addTile(t: TileData): void {
    const ox = t.tx * t.size,
      oz = t.tz * t.size;
    for (const r of t.roads) {
      const half = r.width / 2 + (isCarriageway(r.kind) ? 0.4 : 0.1);
      const v = isCarriageway(r.kind) ? 2 : 1;
      const p = r.points;
      for (let k = 2; k < p.length; k += 2) {
        const ax = ox + p[k - 2],
          az = oz + p[k - 1],
          bx = ox + p[k],
          bz = oz + p[k + 1];
        const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / this.cell));
        for (let s = 0; s <= steps; s++)
          this.fillCircle(ax + ((bx - ax) * s) / steps, az + ((bz - az) * s) / steps, half, v);
      }
    }
    for (const b of t.buildings) {
      const o = b.outline;
      let minX = Infinity,
        minZ = Infinity,
        maxX = -Infinity,
        maxZ = -Infinity;
      for (let k = 0; k < o.length; k += 2) {
        minX = Math.min(minX, o[k]);
        maxX = Math.max(maxX, o[k]);
        minZ = Math.min(minZ, o[k + 1]);
        maxZ = Math.max(maxZ, o[k + 1]);
      }
      for (let z = minZ - 0.5; z <= maxZ + 0.5; z += this.cell) {
        for (let x = minX - 0.5; x <= maxX + 0.5; x += this.cell) {
          if (
            pointInRing(x, z, o) ||
            pointInRing(x + 0.5, z, o) ||
            pointInRing(x - 0.5, z, o) ||
            pointInRing(x, z + 0.5, o) ||
            pointInRing(x, z - 0.5, o)
          )
            this.mark(ox + x, oz + z, 2);
        }
      }
    }
  }

  /** Ist die Kreisscheibe frei? `allowPath`: Fuß-/Feldwege zählen nicht als Hindernis. */
  isFree(x: number, z: number, r: number, allowPath = false): boolean {
    const lim = allowPath ? 2 : 1;
    for (const [dx, dz] of this.disc(r)) {
      const k = this.idx(x + dx, z + dz);
      if (k >= 0 && this.grid[k] >= lim) return false;
    }
    return true;
  }

  /** Liegt der Punkt in dieser Kachel (nicht im Rand)? */
  inTile(x: number, z: number): boolean {
    return (
      x >= this.tx * this.size &&
      x < (this.tx + 1) * this.size &&
      z >= this.tz * this.size &&
      z < (this.tz + 1) * this.size
    );
  }
}
