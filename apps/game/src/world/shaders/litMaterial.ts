import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import type { Scene } from '@babylonjs/core/scene';
import { LIGHTING_GLSL, LIGHTING_UNIFORMS } from './lighting.glsl.ts';

/** Gemeinsamer Vertex-Shader-Kopf: Weltmatrix mit (Thin-)Instanzen. */
export const WORLD_MATRIX_GLSL = /* glsl */ `
#ifdef INSTANCES
attribute vec4 world0;
attribute vec4 world1;
attribute vec4 world2;
attribute vec4 world3;
#endif
uniform mat4 world;
mat4 kcWorld() {
#ifdef INSTANCES
  mat4 w = mat4(world0, world1, world2, world3);
#ifdef THIN_INSTANCES
  w = world * w;
#endif
  return w;
#else
  return world;
#endif
}
`;

const VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
attribute vec4 color;
#ifdef INSTANCESCOLOR
attribute vec4 instanceColor;
#endif
uniform mat4 view;
uniform mat4 viewProjection;
${WORLD_MATRIX_GLSL}
varying vec3 vNormal;
varying vec3 vColor;
varying float vDepth;
void main(void) {
  mat4 w = kcWorld();
  vec4 wp = w * vec4(position, 1.0);
  gl_Position = viewProjection * wp;
  vNormal = normalize(mat3(w) * normal);
  vColor = color.rgb;
#ifdef INSTANCESCOLOR
  vColor *= instanceColor.rgb;
#endif
  vDepth = (view * wp).z;
}`;

const FRAGMENT = /* glsl */ `
precision highp float;
varying vec3 vNormal;
varying vec3 vColor;
varying float vDepth;
${LIGHTING_GLSL}
void main(void) {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  gl_FragColor = vec4(kcFinish(vColor * kcLight(n), vDepth), 1.0);
}`;

/** Welt-Material für Vertex-Farben mit dem gemeinsamen Licht-Baustein (Gelände, Straßen, Bäume). */
export function createLitMaterial(scene: Scene, name: string): ShaderMaterial {
  const m = new ShaderMaterial(
    name,
    scene,
    { vertexSource: VERTEX, fragmentSource: FRAGMENT },
    {
      attributes: ['position', 'normal', 'color'],
      uniforms: ['world', 'view', 'viewProjection', ...LIGHTING_UNIFORMS],
    },
  );
  return m;
}
