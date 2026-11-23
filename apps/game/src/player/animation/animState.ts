import { CLIP_SPEEDS, ONE_SHOT, type ClipName } from './clips.ts';

/** Was die Figur gerade tut: zu Fuß, sitzend auf einem Zweirad oder unsichtbar (im Auto). */
export type FigureMode = 'foot' | 'ride' | 'hidden';

export interface AnimInput {
  /** Waagrechte Geschwindigkeit in m/s. */
  speed: number;
  grounded: boolean;
  /** Senkrechte Geschwindigkeit in m/s (positiv = aufwärts). */
  vy: number;
  mode: FigureMode;
  /** Schnellmodus: immer rennen. */
  fast: boolean;
}

export type AnimEvent = 'enter' | 'exit' | 'jump';

export interface AnimState {
  clip: ClipName;
  /** Restzeit einer einmaligen Animation (s); solange > 0 bleibt sie stehen. */
  lock: number;
  /** Zeit in der Luft (s): erst nach kurzer Zeit „fallen“ (Bordsteinkanten). */
  air: number;
}

export const IDLE_BELOW = 0.25;
/** Ab hier rennen (m/s), mit Hysterese, damit es an der Grenze nicht flackert. */
export const RUN_FROM = 2.8;
const HYST = 0.2;
const FALL_AFTER = 0.3;

export const initialAnim = (): AnimState => ({ clip: 'idle', lock: 0, air: 0 });

/** Nächster Animationszustand (reine Zustandsmaschine). */
export function nextAnim(prev: AnimState, inp: AnimInput, dt: number, event?: AnimEvent): AnimState {
  if (event) return { clip: event, lock: ONE_SHOT[event] ?? 0, air: 0 };
  const air = inp.grounded ? 0 : prev.air + dt;
  // Einmalige Animation läuft zu Ende; danach gelten wieder die Regeln (Einsteigen aufs Zweirad -> sitzen)
  if (prev.lock - dt > 0) return { clip: prev.clip, lock: prev.lock - dt, air };
  if (inp.mode === 'ride') return { clip: 'sit', lock: 0, air: 0 };
  if (inp.mode === 'hidden') return { clip: 'idle', lock: 0, air: 0 };
  if (!inp.grounded && air > FALL_AFTER) return { clip: inp.vy > 0.5 ? 'jump' : 'fall', lock: 0, air };
  if (inp.speed < IDLE_BELOW) return { clip: 'idle', lock: 0, air };
  if (inp.fast) return { clip: 'run', lock: 0, air };
  const runFrom = prev.clip === 'run' ? RUN_FROM - HYST : RUN_FROM + HYST;
  return { clip: inp.speed >= runFrom ? 'run' : 'walk', lock: 0, air };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Abspielgeschwindigkeit: Gehen und Rennen passend zur Bewegung (kein Rutschen der Füße), sonst 1. */
export function speedRatio(clip: ClipName, speed: number): number {
  if (clip === 'walk') return clamp(speed / CLIP_SPEEDS.walk, 0.6, 2.6);
  if (clip === 'run') return clamp(speed / CLIP_SPEEDS.run, 0.7, 2.2);
  return 1;
}
