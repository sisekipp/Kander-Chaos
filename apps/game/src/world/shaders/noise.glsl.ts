/**
 * Wert-Rauschen (eine Rauschfunktion, höchstens 2 Oktaven – Kostengrenze auf dem A9X).
 * kcNoise(p) liefert 0 … 1, kcFbm2(p) zwei Oktaven 0 … 1.
 */
export const NOISE_GLSL = /* glsl */ `
float kcHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float kcNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = kcHash(i);
  float b = kcHash(i + vec2(1.0, 0.0));
  float c = kcHash(i + vec2(0.0, 1.0));
  float d = kcHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float kcFbm2(vec2 p) {
  return kcNoise(p) * 0.65 + kcNoise(p * 2.03 + 17.0) * 0.35;
}
`;
