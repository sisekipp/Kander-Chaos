import { GROUND_LIGHT, HORIZON, SKY_LIGHT, SUN_COLOR, SUN_DIR, WRAP, glslVec3 } from '../sky/skyColors.ts';

/** Uniforms des Licht-Bausteins (in jede ShaderMaterial-Uniformliste aufnehmen). */
export const LIGHTING_UNIFORMS = ['fogRange'];

/**
 * Gemeinsamer Licht- und Nebel-Baustein aller Welt-Shader (Gelände, Straßen, Gebäude, Bäume, Wasser).
 * Spiegelt `world/sky/skyColors.ts`; Konstanten werden von dort eingesetzt, damit TS und GLSL übereinstimmen.
 * - kcLight(n): Hemisphäre + Wrap-Sonne
 * - kcToneMap(c): Khronos-PBR-Neutral-Kurve (im Shader, kein Post-Process-Pass)
 * - kcFinish(c, depth): Tone-Mapping, dann linearer Nebel in Horizontfarbe
 */
export const LIGHTING_GLSL = /* glsl */ `
uniform vec2 fogRange;
const vec3 KC_SUN_DIR = ${glslVec3(SUN_DIR)};
const vec3 KC_SUN_COLOR = ${glslVec3(SUN_COLOR)};
const vec3 KC_SKY_LIGHT = ${glslVec3(SKY_LIGHT)};
const vec3 KC_GROUND_LIGHT = ${glslVec3(GROUND_LIGHT)};
const vec3 KC_HORIZON = ${glslVec3(HORIZON)};
const float KC_WRAP = ${WRAP.toFixed(4)};

vec3 kcLight(vec3 n) {
  float d = max(0.0, (dot(n, -KC_SUN_DIR) + KC_WRAP) / (1.0 + KC_WRAP));
  return mix(KC_GROUND_LIGHT, KC_SKY_LIGHT, n.y * 0.5 + 0.5) + KC_SUN_COLOR * d;
}

vec3 kcToneMap(vec3 c) {
  const float start = 0.76;
  const float desat = 0.15;
  float x = min(c.r, min(c.g, c.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  c -= offset;
  float peak = max(c.r, max(c.g, c.b));
  if (peak < start) return c;
  const float d = 1.0 - start;
  float newPeak = 1.0 - d * d / (peak + d - start);
  c *= newPeak / peak;
  float g = 1.0 - 1.0 / (desat * (peak - newPeak) + 1.0);
  return mix(c, vec3(newPeak), g);
}

vec3 kcFinish(vec3 lit, float depth) {
  float f = clamp((depth - fogRange.x) / max(0.001, fogRange.y - fogRange.x), 0.0, 1.0);
  return mix(kcToneMap(lit), KC_HORIZON, f);
}
`;
