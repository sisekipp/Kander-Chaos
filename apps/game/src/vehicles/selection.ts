import type { VehicleKind } from '@kandern/world-format';

/** Parkposition in Weltkoordinaten. */
export interface Spot {
  id: number;
  x: number;
  z: number;
  heading: number;
  kind: VehicleKind;
  tileId: string;
}

export interface SelectionOptions {
  maxVehicles: number;
  maxDynamic: number;
  /** Entfernung, ab der eine Stelle als „außer Sicht“ gilt (m). */
  sightRadius: number;
  /** So lange muss eine zerstörte Stelle außer Sicht sein, bevor sie neu besetzt wird (ms). */
  respawnAfterMs: number;
  /** Bis zu dieser Entfernung bleibt das zuletzt gefahrene Fahrzeug erhalten (m). */
  keepLastDrivenM: number;
}

export const DEFAULT_SELECTION: SelectionOptions = {
  maxVehicles: 24,
  maxDynamic: 8,
  sightRadius: 80,
  respawnAfterMs: 60_000,
  keepLastDrivenM: 1000,
};

interface Destroyed {
  destroyedAt: number;
  lastSeen: number;
  tileReloaded: boolean;
}

/**
 * Entscheidet, welche Parkpositionen besetzt werden, welche Fahrzeuge volle Physik bekommen und wann
 * zerstörte Stellen wieder besetzt werden (reine Logik, Spec vehicles + vehicle-damage).
 */
export class VehicleSelection {
  private readonly destroyed = new Map<number, Destroyed>();
  constructor(readonly o: SelectionOptions = DEFAULT_SELECTION) {}

  /** Stellen, die jetzt besetzt sein sollen: die nächsten, ohne gesperrte zerstörte Stellen. */
  chooseSpots(spots: Spot[], px: number, pz: number, now: number, reservedCount = 0): Spot[] {
    const free = spots.filter((s) => !this.isBlocked(s.id, now));
    free.sort((a, b) => dist2(a, px, pz) - dist2(b, px, pz) || a.id - b.id);
    return free.slice(0, Math.max(0, this.o.maxVehicles - reservedCount));
  }

  /**
   * Welche Fahrzeuge volle Physik bekommen: das gefahrene immer, außerdem bewegte bzw. angestoßene
   * (`awake`) und dann die nächsten – höchstens `maxDynamic`.
   */
  chooseDynamic(
    vehicles: { id: number; x: number; z: number; awake: boolean }[],
    px: number,
    pz: number,
    drivenId: number | null,
  ): Set<number> {
    const out = new Set<number>();
    if (drivenId !== null) out.add(drivenId);
    const rest = vehicles
      .filter((v) => v.id !== drivenId)
      .sort((a, b) => Number(b.awake) - Number(a.awake) || dist2(a, px, pz) - dist2(b, px, pz));
    for (const v of rest) {
      if (out.size >= this.o.maxDynamic) break;
      if (v.awake || dist2(v, px, pz) < 30 * 30) out.add(v.id);
    }
    return out;
  }

  /** Bleibt das zuletzt gefahrene Fahrzeug erhalten, auch wenn seine Kachel entladen wird? */
  keepLastDriven(x: number, z: number, px: number, pz: number): boolean {
    return dist2({ x, z }, px, pz) <= this.o.keepLastDrivenM ** 2;
  }

  markDestroyed(spotId: number, now: number): void {
    this.destroyed.set(spotId, { destroyedAt: now, lastSeen: now, tileReloaded: false });
  }

  /** Pro Aktualisierung: merkt sich, wann zerstörte Stellen zuletzt in Sichtweite waren. */
  observe(spots: Spot[], px: number, pz: number, now: number): void {
    for (const s of spots) {
      const d = this.destroyed.get(s.id);
      if (d && dist2(s, px, pz) <= this.o.sightRadius ** 2) d.lastSeen = now;
    }
  }

  /** Kachel wurde entladen -> zerstörte Stellen darin dürfen beim Neuladen wieder besetzt werden. */
  tileUnloaded(spotIds: Iterable<number>): void {
    for (const id of spotIds) {
      const d = this.destroyed.get(id);
      if (d) d.tileReloaded = true;
    }
  }

  isBlocked(spotId: number, now: number): boolean {
    const d = this.destroyed.get(spotId);
    if (!d) return false;
    if (d.tileReloaded || now - d.lastSeen >= this.o.respawnAfterMs) {
      this.destroyed.delete(spotId);
      return false;
    }
    return true;
  }
}

const dist2 = (p: { x: number; z: number }, x: number, z: number) => (p.x - x) ** 2 + (p.z - z) ** 2;
