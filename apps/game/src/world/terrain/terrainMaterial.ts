import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import type { Scene } from '@babylonjs/core/scene';
import { LIGHTING_GLSL, LIGHTING_UNIFORMS } from '../shaders/lighting.glsl.ts';
import { NOISE_GLSL } from '../shaders/noise.glsl.ts';

const VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
attribute vec4 color;
attribute vec2 uv;
attribute vec2 uv2;
uniform mat4 world;
uniform mat4 view;
uniform mat4 viewProjection;
varying vec3 vNormal;
varying vec3 vColor;
varying vec2 vWorld;
varying vec2 vMask;
varying vec2 vMask2;
varying float vDepth;
void main(void) {
  vec4 wp = world * vec4(position, 1.0);
  gl_Position = viewProjection * wp;
  vNormal = normalize(mat3(world) * normal);
  vColor = color.rgb;
  vWorld = wp.xz;
  vMask = uv;
  vMask2 = uv2;
  vDepth = (view * wp).z;
}`;

/**
 * Boden-Shader: Muster je Landnutzung aus Vertex-Gewichten (Pipeline-Daten im Worker gemischt).
 * - Acker: Furchen sin(Querposition) in Feldrichtung, per fwidth in der Ferne ausgeblendet
 * - Wiese/überall: zwei Oktaven Wert-Rauschen
 * - Wald: dunkle Flecken;  Siedlung: gleichmäßiger Rasen
 * `detail` = 0 (Ring 1/2): nur Vertex-Farbe ohne Muster.
 */
const FRAGMENT = /* glsl */ `
#extension GL_OES_standard_derivatives : enable
precision highp float;
varying vec3 vNormal;
varying vec3 vColor;
varying vec2 vWorld;
varying vec2 vMask;
varying vec2 vMask2;
varying float vDepth;
uniform float detail;
${LIGHTING_GLSL}
${NOISE_GLSL}
void main(void) {
  vec3 col = vColor;
  if (detail > 0.5) {
    float n = kcFbm2(vWorld * 0.18);
    col *= 0.9 + 0.2 * n;
    // Gewicht verläuft stetig über die Feldkante (0,5 = Kante) -> hier auf die Kante schärfen
    float farm = smoothstep(0.42, 0.7, vMask.x);
    if (farm > 0.01) {
      float a = vMask2.y;
      float s = dot(vWorld, vec2(-sin(a), cos(a))) / 1.6;
      float aa = 1.0 - smoothstep(0.25, 0.6, fwidth(s));
      float furrow = 0.5 + 0.5 * sin(s * 6.2832);
      col *= mix(1.0, 0.8 + 0.2 * furrow, farm * aa);
    }
    float forest = vMask.y;
    if (forest > 0.01) {
      float f = kcNoise(vWorld * 0.09 + 31.0);
      col *= mix(1.0, 0.72 + 0.34 * f, forest);
    }
    // Siedlung: Gärten etwas gleichmäßiger (gepflegter Rasen) statt Wiesenflecken
    float town = vMask2.x;
    col = mix(col, vColor * (0.96 + 0.08 * n), town * 0.6);
  }
  vec3 nrm = normalize(vNormal);
  gl_FragColor = vec4(kcFinish(col * kcLight(nrm), vDepth), 1.0);
}`;

/** Gelände-Material (detail 1 = Ring 0 mit Mustern, 0 = Fernkacheln ohne Muster). */
export function createTerrainMaterial(scene: Scene, name: string, detail: number): ShaderMaterial {
  const m = new ShaderMaterial(
    name,
    scene,
    { vertexSource: VERTEX, fragmentSource: FRAGMENT },
    {
      attributes: ['position', 'normal', 'color', 'uv', 'uv2'],
      uniforms: ['world', 'view', 'viewProjection', 'detail', ...LIGHTING_UNIFORMS],
    },
  );
  m.setFloat('detail', detail);
  return m;
}
