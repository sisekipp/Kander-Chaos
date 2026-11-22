import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import type { Scene } from '@babylonjs/core/scene';
import { LIGHTING_GLSL, LIGHTING_UNIFORMS } from '../shaders/lighting.glsl.ts';
import { NOISE_GLSL } from '../shaders/noise.glsl.ts';

const VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
attribute vec2 uv2;
uniform mat4 world;
uniform mat4 view;
uniform mat4 viewProjection;
varying vec3 vWorldPos;
varying vec2 vUV;
varying vec2 vUV2;
varying float vDepth;
void main(void) {
  vec4 wp = world * vec4(position, 1.0);
  gl_Position = viewProjection * wp;
  vWorldPos = wp.xyz;
  vUV = uv;
  vUV2 = uv2;
  vDepth = (view * wp).z;
}`;

/**
 * Wasser ohne Alpha-Blending (Fill-Rate): Grundfarbe, Ufer heller, Wellen als verschobenes Rauschen
 * in Fließrichtung (uv.y + Zeit), gestörte Normale für ein Glanzlicht aus Sonnenrichtung.
 * uv2 = (halbe Breite, 1 = fließend) bei Bändern, (0, 0) bei stehenden Flächen.
 */
const FRAGMENT = /* glsl */ `
precision highp float;
varying vec3 vWorldPos;
varying vec2 vUV;
varying vec2 vUV2;
varying float vDepth;
uniform float time;
uniform vec3 cameraPosition;
${LIGHTING_GLSL}
${NOISE_GLSL}
void main(void) {
  float flowing = vUV2.y;
  float hw = vUV2.x;
  // Wellenkoordinate: Bänder in Fließrichtung, Flächen in Weltkoordinaten mit langsamer Drift
  vec2 p = flowing > 0.5 ? vec2(vUV.x * 1.6, vUV.y * 0.8 - time * 1.2) : vWorldPos.xz * 0.7 + vec2(time * 0.08, time * 0.05);
  float e = 0.35;
  float h = kcFbm2(p);
  float hx = kcFbm2(p + vec2(e, 0.0));
  float hz = kcFbm2(p + vec2(0.0, e));
  vec3 n = normalize(vec3((h - hx) * 0.7, 1.0, (h - hz) * 0.7));
  vec3 deep = vec3(0.1, 0.22, 0.26);
  vec3 shallow = vec3(0.22, 0.36, 0.34);
  float shore = flowing > 0.5 ? smoothstep(0.5, 1.0, abs(vUV.x) / max(hw, 0.5)) : 0.0;
  vec3 col = mix(deep, shallow, shore * 0.8 + h * 0.12);
  vec3 lit = col * kcLight(n);
  vec3 v = normalize(cameraPosition - vWorldPos);
  vec3 hv = normalize(-KC_SUN_DIR + v);
  float spec = pow(max(dot(n, hv), 0.0), 90.0) * 0.8;
  float fres = pow(1.0 - max(dot(v, vec3(0.0, 1.0, 0.0)), 0.0), 3.0);
  lit += vec3(spec) + KC_HORIZON * fres * 0.25;
  gl_FragColor = vec4(kcFinish(lit, vDepth), 1.0);
}`;

/** Wasser-Material; `time` (s) wird je Bild gesetzt. */
export function createWaterMaterial(scene: Scene): ShaderMaterial {
  const m = new ShaderMaterial(
    'water',
    scene,
    { vertexSource: VERTEX, fragmentSource: FRAGMENT },
    {
      attributes: ['position', 'normal', 'uv', 'uv2'],
      uniforms: ['world', 'view', 'viewProjection', 'cameraPosition', 'time', ...LIGHTING_UNIFORMS],
    },
  );
  m.setFloat('time', 0);
  m.zOffset = -3;
  return m;
}
