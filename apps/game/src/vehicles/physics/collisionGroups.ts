/** Kollisionsgruppen (Bitmasken) für Havok-Shapes. */
export const GROUP = {
  WORLD: 1,
  VEHICLE: 2,
  PROP: 4,
  DEBRIS: 8,
  CHARACTER: 16,
} as const;

export const ALL = 0xffffffff;
/** Trümmer stoßen nicht mit der Spielfigur zusammen (kein Stolpern über Splitter). */
export const DEBRIS_COLLIDES = ALL & ~GROUP.CHARACTER;
