import { PropKind } from '@kandern/world-format';

/** Wie ein Kleinobjekt auf einen Treffer reagiert (Spec destructible-props). */
export type PropReaction = 'fly' | 'shatter' | 'topple';

export interface PropRule {
  /** Ab dieser Aufprallgeschwindigkeit (km/h) reagiert das Objekt. */
  thresholdKmh: number;
  reaction: PropReaction;
  /** Trefferradius (m). */
  radius: number;
  /** Anzahl Trümmerteile beim Zerbrechen (3–8). */
  pieces: number;
  /** Blockiert die Spielfigur zu Fuß (statischer Collider im Nahbereich). */
  blocksWalker: boolean;
  /** Abbremsung des Verursachers (Anteil der Geschwindigkeit, der verloren geht). */
  slowdown: number;
}

/**
 * Laufen = 18 km/h: Büsche, Zäune, Mülleimer, Fahrradbügel und Blumenkübel gehen auch zu Fuß kaputt;
 * Laternen, Schilder, Bänke, Briefkästen, Hydranten, Poller und Litfaßsäulen nicht.
 */
export const PROP_RULES: Record<PropKind, PropRule> = {
  [PropKind.Bush]: {
    thresholdKmh: 8,
    reaction: 'shatter',
    radius: 0.8,
    pieces: 6,
    blocksWalker: false,
    slowdown: 0.04,
  },
  [PropKind.Bin]: { thresholdKmh: 8, reaction: 'fly', radius: 0.35, pieces: 0, blocksWalker: false, slowdown: 0.03 },
  [PropKind.Fence]: {
    thresholdKmh: 12,
    reaction: 'shatter',
    radius: 0.9,
    pieces: 5,
    blocksWalker: false,
    slowdown: 0.05,
  },
  [PropKind.Sign]: {
    thresholdKmh: 20,
    reaction: 'shatter',
    radius: 0.2,
    pieces: 3,
    blocksWalker: true,
    slowdown: 0.06,
  },
  [PropKind.Lamp]: { thresholdKmh: 25, reaction: 'topple', radius: 0.2, pieces: 0, blocksWalker: true, slowdown: 0.12 },
  [PropKind.Bench]: { thresholdKmh: 20, reaction: 'fly', radius: 0.9, pieces: 0, blocksWalker: true, slowdown: 0.08 },
  [PropKind.PostBox]: {
    thresholdKmh: 20,
    reaction: 'fly',
    radius: 0.35,
    pieces: 0,
    blocksWalker: true,
    slowdown: 0.08,
  },
  [PropKind.Hydrant]: {
    thresholdKmh: 30,
    reaction: 'topple',
    radius: 0.2,
    pieces: 0,
    blocksWalker: true,
    slowdown: 0.15,
  },
  [PropKind.Bollard]: {
    thresholdKmh: 25,
    reaction: 'topple',
    radius: 0.15,
    pieces: 0,
    blocksWalker: true,
    slowdown: 0.2,
  },
  [PropKind.BikeRack]: {
    thresholdKmh: 15,
    reaction: 'shatter',
    radius: 0.45,
    pieces: 4,
    blocksWalker: false,
    slowdown: 0.06,
  },
  [PropKind.AdColumn]: {
    thresholdKmh: 35,
    reaction: 'topple',
    radius: 0.65,
    pieces: 0,
    blocksWalker: true,
    slowdown: 0.35,
  },
  [PropKind.Planter]: {
    thresholdKmh: 12,
    reaction: 'shatter',
    radius: 0.55,
    pieces: 6,
    blocksWalker: false,
    slowdown: 0.1,
  },
};

/** Löst ein Treffer mit `kmh` das Objekt aus? */
export function triggers(kind: PropKind, kmh: number): boolean {
  return kmh >= PROP_RULES[kind].thresholdKmh;
}

/** Startimpuls (m/s) des ausgelösten Objekts aus der Geschwindigkeit des Verursachers. */
export function launchVelocity(vx: number, vz: number, kind: PropKind): { vx: number; vy: number; vz: number } {
  const k = kind === PropKind.Bin ? 1.1 : kind === PropKind.Bench || kind === PropKind.PostBox ? 0.6 : 0.8;
  const speed = Math.hypot(vx, vz);
  return { vx: vx * k, vy: Math.min(6, 1.5 + speed * 0.15), vz: vz * k };
}
