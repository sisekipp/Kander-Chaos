/**
 * Schadensmodell (reine Logik, Spec vehicle-damage / Design D4).
 * Zustand 1 = heil, 0 = Totalschaden. Unter 10 km/h kein Schaden; darüber a·(v−10)^1.4,
 * so gewählt, dass ein Frontalaufprall mit 60 km/h gegen eine Wand ≈ 35 Prozentpunkte kostet.
 * Kleinobjekte kosten höchstens 2 Prozentpunkte. Kontakte prellen -> höchstens ein Treffer je 150 ms.
 */
export type ImpactPartner = 'world' | 'vehicle' | 'prop';

export const NO_DAMAGE_KMH = 10;
export const PROP_MAX_DAMAGE = 0.02;
export const DEBOUNCE_MS = 150;
const A = 0.35 / Math.pow(60 - NO_DAMAGE_KMH, 1.4);

/** Schaden (0..1) eines Aufpralls mit `kmh` Aufprallgeschwindigkeit (entlang der Kontaktnormalen). */
export function impactDamage(kmh: number, partner: ImpactPartner): number {
  if (kmh < NO_DAMAGE_KMH) return 0;
  const d = A * Math.pow(kmh - NO_DAMAGE_KMH, 1.4);
  return partner === 'prop' ? Math.min(PROP_MAX_DAMAGE, d) : Math.min(1, d);
}

/** Zustand eines Fahrzeugs mit Entprellung. */
export class DamageState {
  health = 1;
  private lastHit = -Infinity;

  /** Wendet einen Aufprall an; liefert den tatsächlich abgezogenen Schaden. */
  hit(now: number, kmh: number, partner: ImpactPartner): number {
    if (this.health <= 0) return 0;
    const d = impactDamage(kmh, partner);
    if (d <= 0) return 0;
    if (now - this.lastHit < DEBOUNCE_MS) return 0;
    this.lastHit = now;
    const before = this.health;
    this.health = Math.max(0, this.health - d);
    return before - this.health;
  }

  get wrecked(): boolean {
    return this.health <= 0;
  }
}
