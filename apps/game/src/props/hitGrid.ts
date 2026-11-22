/** Trefferraster (reine Logik): Kleinobjekte einer Kachel in 4-m-Zellen, Abfrage per Kreis (Design D5). */
export interface GridProp {
  /** Index innerhalb der Kachel. */
  index: number;
  x: number;
  z: number;
  /** Trefferradius des Objekts (m). */
  radius: number;
}

export class HitGrid {
  private readonly cells = new Map<number, GridProp[]>();

  constructor(private readonly cellSize = 4) {}

  private key(i: number, j: number): number {
    return (i + 32768) * 65536 + (j + 32768);
  }

  add(p: GridProp): void {
    const k = this.key(Math.floor(p.x / this.cellSize), Math.floor(p.z / this.cellSize));
    let list = this.cells.get(k);
    if (!list) this.cells.set(k, (list = []));
    list.push(p);
  }

  /** Alle Objekte, deren Trefferkreis den Kreis (x, z, r) schneidet. */
  query(x: number, z: number, r: number, out: GridProp[] = []): GridProp[] {
    out.length = 0;
    const reach = r + 1.5; // größter Objektradius
    const i0 = Math.floor((x - reach) / this.cellSize),
      i1 = Math.floor((x + reach) / this.cellSize);
    const j0 = Math.floor((z - reach) / this.cellSize),
      j1 = Math.floor((z + reach) / this.cellSize);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        for (const p of this.cells.get(this.key(i, j)) ?? []) {
          if ((p.x - x) ** 2 + (p.z - z) ** 2 <= (p.radius + r) ** 2) out.push(p);
        }
      }
    }
    return out;
  }
}
