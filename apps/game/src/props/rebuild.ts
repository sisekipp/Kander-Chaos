/**
 * Wiederaufbau (reine Logik): ein zerstörtes Kleinobjekt steht wieder, sobald seine Stelle 60 s außer Sicht
 * war (weiter als `sightRadius`) oder die Kachel neu geladen wurde (dann wird der Zustand ohnehin verworfen).
 */
export class RebuildTracker {
  private readonly destroyed = new Map<number, { lastSeen: number; x: number; z: number }>();

  constructor(
    private readonly respawnMs = 60_000,
    private readonly sightRadius = 80,
  ) {}

  markDestroyed(index: number, x: number, z: number, now: number): void {
    this.destroyed.set(index, { lastSeen: now, x, z });
  }

  isDestroyed(index: number): boolean {
    return this.destroyed.has(index);
  }

  get count(): number {
    return this.destroyed.size;
  }

  /** Aktualisiert Sichtzeiten und liefert die Indizes, die jetzt wieder aufgebaut werden. */
  update(px: number, pz: number, now: number): number[] {
    const back: number[] = [];
    for (const [i, d] of this.destroyed) {
      if ((d.x - px) ** 2 + (d.z - pz) ** 2 <= this.sightRadius ** 2) d.lastSeen = now;
      else if (now - d.lastSeen >= this.respawnMs) back.push(i);
    }
    for (const i of back) this.destroyed.delete(i);
    return back;
  }
}
