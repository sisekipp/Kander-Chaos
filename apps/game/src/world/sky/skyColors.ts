/**
 * Farben und Lichtkurven der Welt – eine Quelle für TypeScript (Tests, Vertex-Farben, Babylon-Lichter)
 * und für die GLSL-Bausteine in `world/shaders/`. Werte im Anzeige-Farbraum (keine sRGB-Umrechnung).
 */
export type RGB = [number, number, number];

/** Richtung, in die das Sonnenlicht fällt (normiert, zeigt nach unten). */
export const SUN_DIR: RGB = normalize([-0.5, -0.75, 0.4]);
export const SUN_COLOR: RGB = [1.0, 0.96, 0.88];
/** Hemisphärenlicht: Himmel oben, Boden unten. */
export const SKY_LIGHT: RGB = [0.6, 0.66, 0.74];
export const GROUND_LIGHT: RGB = [0.4, 0.37, 0.31];
/** Himmelsverlauf: Zenit und Horizont (= Nebelfarbe). */
export const ZENITH: RGB = [0.33, 0.55, 0.84];
export const HORIZON: RGB = [0.74, 0.83, 0.9];
/** Farbe des Sonnenglühens am Himmel. */
export const SUN_GLOW: RGB = [1, 0.93, 0.78];
/** Wrap-Anteil der Sonne: Schattenseiten bleiben aufgehellt statt schwarz. */
export const WRAP = 0.35;

export function normalize(v: RGB): RGB {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** Wrap-Lambert: max(0, (n·l + w) / (1 + w)). */
export function wrapDiffuse(nDotL: number, w = WRAP): number {
  return Math.max(0, (nDotL + w) / (1 + w));
}

/** Hemisphärenlicht für die y-Komponente der Normalen. */
export function hemiLight(ny: number): RGB {
  return mix(GROUND_LIGHT, SKY_LIGHT, ny * 0.5 + 0.5);
}

/** Lichtsumme (Hemisphäre + Sonne) für eine Normale. */
export function lightAt(n: RGB): RGB {
  const d = wrapDiffuse(-(n[0] * SUN_DIR[0] + n[1] * SUN_DIR[1] + n[2] * SUN_DIR[2]));
  const h = hemiLight(n[1]);
  return [h[0] + SUN_COLOR[0] * d, h[1] + SUN_COLOR[1] * d, h[2] + SUN_COLOR[2] * d];
}

/** Tone-Mapping nach Khronos PBR Neutral: unterhalb von ~0,76 unverändert, darüber weich auf 1 begrenzt. */
export function toneMap(c: RGB): RGB {
  const start = 0.8 - 0.04;
  const desat = 0.15;
  const x = Math.min(c[0], c[1], c[2]);
  const offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  let r: RGB = [c[0] - offset, c[1] - offset, c[2] - offset];
  const peak = Math.max(r[0], r[1], r[2]);
  if (peak < start) return r;
  const d = 1 - start;
  const newPeak = 1 - (d * d) / (peak + d - start);
  r = [(r[0] * newPeak) / peak, (r[1] * newPeak) / peak, (r[2] * newPeak) / peak];
  const g = 1 - 1 / (desat * (peak - newPeak) + 1);
  return mix(r, [newPeak, newPeak, newPeak], g);
}

/** Linearer Distanznebel 0 … 1. */
export function fogFactor(dist: number, start: number, end: number): number {
  return clamp01((dist - start) / Math.max(1e-3, end - start));
}

/** Endfarbe eines Welt-Pixels: Licht, Tone-Mapping, dann Nebel in Horizontfarbe. */
export function shade(albedo: RGB, n: RGB, dist: number, fogStart: number, fogEnd: number): RGB {
  const l = lightAt(n);
  const t = toneMap([albedo[0] * l[0], albedo[1] * l[1], albedo[2] * l[2]]);
  return mix(t, HORIZON, fogFactor(dist, fogStart, fogEnd));
}

/** Himmelsfarbe für die Höhe `elev` (= y der Blickrichtung, −1 … 1); unter dem Horizont Horizontfarbe. */
export function skyGradient(elev: number): RGB {
  return mix(HORIZON, ZENITH, Math.sqrt(clamp01(elev)));
}

/** GLSL-Literal für einen Farbwert. */
export const glslVec3 = (c: RGB) => `vec3(${c.map((v) => v.toFixed(4)).join(', ')})`;
