import { Constants } from '@babylonjs/core/Engines/constants';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { HORIZON, SUN_DIR, SUN_GLOW, ZENITH, glslVec3 } from './skyColors.ts';

const VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
uniform mat4 world;
uniform mat4 viewProjection;
varying vec3 vDir;
void main(void) {
  vDir = position;
  vec4 p = viewProjection * world * vec4(position, 1.0);
  // Auf die hintere Tiefenebene legen: Himmel liegt hinter allem, ohne die Sichtweite zu beschränken
  gl_Position = vec4(p.xy, p.w * 0.999999, p.w);
}`;

const FRAGMENT = /* glsl */ `
precision highp float;
varying vec3 vDir;
const vec3 ZENITH = ${glslVec3(ZENITH)};
const vec3 HORIZON = ${glslVec3(HORIZON)};
const vec3 SUN_GLOW = ${glslVec3(SUN_GLOW)};
const vec3 TO_SUN = ${glslVec3([-SUN_DIR[0], -SUN_DIR[1], -SUN_DIR[2]])};
void main(void) {
  vec3 d = normalize(vDir);
  vec3 col = mix(HORIZON, ZENITH, sqrt(clamp(d.y, 0.0, 1.0)));
  float s = max(dot(d, TO_SUN), 0.0);
  col += SUN_GLOW * (pow(s, 24.0) * 0.35 + smoothstep(0.9985, 0.9993, s) * 0.6);
  gl_FragColor = vec4(min(col, vec3(1.0)), 1.0);
}`;

/**
 * Himmelskuppel mit Verlauf (Horizont -> Zenit) und Sonnenglühen. Sie deckt jedes Pixel ab,
 * deshalb kann `scene.autoClear` aus bleiben (spart einen Vollbild-Clear auf dem A9X).
 */
export function createSkyDome(scene: Scene): { mesh: Mesh; dispose(): void } {
  const mesh = CreateSphere('sky', { diameter: 100, segments: 12, sideOrientation: 1 }, scene);
  mesh.infiniteDistance = true;
  mesh.isPickable = false;
  mesh.alwaysSelectAsActiveMesh = true;
  mesh.doNotSyncBoundingInfo = true;
  const mat = new ShaderMaterial(
    'sky',
    scene,
    { vertexSource: VERTEX, fragmentSource: FRAGMENT },
    { attributes: ['position'], uniforms: ['world', 'viewProjection'] },
  );
  mat.disableDepthWrite = true;
  mat.depthFunction = Constants.LEQUAL;
  mat.backFaceCulling = false;
  mat.freeze();
  mesh.material = mat;
  return {
    mesh,
    dispose() {
      mesh.dispose();
      mat.dispose();
    },
  };
}
