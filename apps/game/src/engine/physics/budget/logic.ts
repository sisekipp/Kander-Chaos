/**
 * Physik-Budget (reine Logik): zählt dynamische Körper und entscheidet, was ausgeblendet, eingefroren
 * oder entfernt wird. Spec destructible-props: höchstens 80 dynamische Körper, höchstens 60 Trümmer;
 * Trümmer und umgestoßene Objekte verschwinden nach 8 s Ruhe, Fahrzeugteile nach 10 s, Wracks nach 20 s.
 */
export type BodyKind = 'vehicle' | 'prop' | 'debris' | 'part' | 'wreck';

export type BudgetAction = { id: number; action: 'fade' | 'freeze' | 'remove' };

export interface BudgetOptions {
  maxBodies: number;
  maxDebris: number;
  /** Ruhezeit (ms) bis zum Ausblenden je Art; Wracks zählen ab Erstellung. */
  fadeAfterMs: Record<Exclude<BodyKind, 'vehicle'>, number>;
}

export const DEFAULT_BUDGET: BudgetOptions = {
  maxBodies: 80,
  maxDebris: 60,
  fadeAfterMs: { prop: 8000, debris: 8000, part: 10000, wreck: 20000 },
};

interface Entry {
  id: number;
  kind: BodyKind;
  createdAt: number;
  restingSince: number | null;
  /** Wird gerade ausgeblendet – zählt nicht mehr, wird nicht doppelt gemeldet. */
  leaving: boolean;
}

export class BodyBudget {
  private readonly entries = new Map<number, Entry>();
  private nextId = 1;

  constructor(private readonly o: BudgetOptions = DEFAULT_BUDGET) {}

  /** Anzahl aktiver (nicht ausscheidender) dynamischer Körper. */
  get count(): number {
    let n = 0;
    for (const e of this.entries.values()) if (!e.leaving) n++;
    return n;
  }

  countOf(kind: BodyKind): number {
    let n = 0;
    for (const e of this.entries.values()) if (!e.leaving && e.kind === kind) n++;
    return n;
  }

  /** Neuen dynamischen Körper anmelden. Liefert die ID und sofort nötige Verdrängungen. */
  add(kind: BodyKind, now: number): { id: number; actions: BudgetAction[] } {
    const id = this.nextId++;
    this.entries.set(id, { id, kind, createdAt: now, restingSince: null, leaving: false });
    return { id, actions: this.enforce(id) };
  }

  setResting(id: number, resting: boolean, now: number): void {
    const e = this.entries.get(id);
    if (!e) return;
    if (resting && e.restingSince === null) e.restingSince = now;
    if (!resting) e.restingSince = null;
  }

  /** Körper ist weg (entfernt oder eingefroren -> nicht mehr dynamisch). */
  remove(id: number): void {
    this.entries.delete(id);
  }

  /** Zeitgesteuerte Aktionen (Ausblenden nach Ruhezeit). */
  tick(now: number): BudgetAction[] {
    const out: BudgetAction[] = [];
    for (const e of this.entries.values()) {
      if (e.leaving || e.kind === 'vehicle') continue;
      const after = this.o.fadeAfterMs[e.kind];
      const since = e.kind === 'wreck' ? e.createdAt : e.restingSince;
      if (since !== null && now - since >= after) {
        e.leaving = true;
        out.push({ id: e.id, action: 'fade' });
      }
    }
    return out;
  }

  /** Obergrenzen durchsetzen: zuerst ruhende Trümmer/Teile entfernen, dann ruhende Props einfrieren, notfalls älteste Trümmer. */
  private enforce(justAdded: number): BudgetAction[] {
    const out: BudgetAction[] = [];
    const active = () =>
      [...this.entries.values()].filter((e) => !e.leaving).sort((a, b) => a.createdAt - b.createdAt || a.id - b.id);
    const evict = (e: Entry, action: BudgetAction['action']) => {
      e.leaving = true;
      out.push({ id: e.id, action });
    };
    // Trümmer-Obergrenze
    let debris = active().filter((e) => e.kind === 'debris');
    while (debris.length > this.o.maxDebris) {
      const victim = debris.find((e) => e.id !== justAdded) ?? debris[0];
      evict(victim, 'remove');
      debris = debris.filter((e) => e !== victim);
    }
    // Gesamt-Obergrenze
    const order: [(e: Entry) => boolean, BudgetAction['action']][] = [
      [(e) => e.kind === 'debris' && e.restingSince !== null, 'remove'],
      [(e) => e.kind === 'part' && e.restingSince !== null, 'remove'],
      [(e) => e.kind === 'prop' && e.restingSince !== null, 'freeze'],
      [(e) => e.kind === 'debris', 'remove'],
      [(e) => e.kind === 'part', 'remove'],
      [(e) => e.kind === 'prop', 'freeze'],
      [(e) => e.kind === 'wreck', 'remove'],
    ];
    for (const [match, action] of order) {
      while (this.count > this.o.maxBodies) {
        const victim = active().find((e) => match(e) && e.id !== justAdded);
        if (!victim) break;
        evict(victim, action);
      }
    }
    return out;
  }
}
