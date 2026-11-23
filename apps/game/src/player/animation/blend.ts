import type { ClipName } from './clips.ts';

/** Überblendzeit zwischen zwei Animationen (Spec: innerhalb von 0,3 s). */
export const BLEND_TIME = 0.3;

export type Weights = Partial<Record<ClipName, number>>;

/**
 * Ein Überblendschritt: jede bisherige Animation baut linear ab (nach `time` ist sie weg, egal wie oft das Ziel
 * wechselt), das Ziel bekommt den Rest. Die Summe bleibt 1.
 */
export function blendStep(w: Weights, target: ClipName, dt: number, time = BLEND_TIME): Weights {
  const fall = time > 0 ? dt / time : 1;
  const out: Weights = {};
  let rest = 1;
  for (const [c, v] of Object.entries(w) as [ClipName, number][]) {
    if (c === target) continue;
    const nv = v - fall;
    if (nv > 1e-3) {
      out[c] = nv;
      rest -= nv;
    }
  }
  out[target] = rest;
  return out;
}
