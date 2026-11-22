import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector2, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';

/**
 * Fassaden prozedural im Fragment-Shader statt per Texturatlas: Fenster, Fachwerkbalken,
 * Holzlatten, Glasbänder und Dachziegel entstehen aus uv (Meter) und uv2.x (Fassadentyp).
 * Vorteil: 0 Byte Texturdaten, ein Material für alle Gebäude, beliebig skalierbar.
 */
const VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
attribute vec4 color;
attribute vec2 uv;
attribute vec2 uv2;
uniform mat4 world;
uniform mat4 viewProjection;
uniform mat4 view;
varying vec3 vNormal;
varying vec4 vColor;
varying vec2 vUV;
varying vec2 vUV2;
varying float vDepth;
void main(void) {
  vec4 wp = world * vec4(position, 1.0);
  gl_Position = viewProjection * wp;
  vNormal = normalize(mat3(world) * normal);
  vColor = color;
  vUV = uv;
  vUV2 = uv2;
  vDepth = (view * wp).z;
}`;

const FRAGMENT = /* glsl */ `
precision highp float;
varying vec3 vNormal;
varying vec4 vColor;
varying vec2 vUV;
varying vec2 vUV2;
varying float vDepth;
uniform vec3 sunDir;
uniform vec3 sunColor;
uniform vec3 skyColor;
uniform vec3 groundColor;
uniform vec3 fogColor;
uniform vec2 fogRange;
uniform float detail;

float box(vec2 p, vec2 lo, vec2 hi) {
  vec2 s = step(lo, p) * step(p, hi);
  return s.x * s.y;
}

void main(void) {
  vec3 base = vColor.rgb;
  float facade = floor(vUV2.x + 0.5);
  float levelH = max(vUV2.y, 2.2);
  vec2 uv = vUV;
  vec3 col = base;
  float isWall = 1.0 - step(9.5, facade);
  if (detail > 0.5 && isWall > 0.5 && abs(vNormal.y) < 0.5) {
    // Fensterraster: 3 m horizontal, eine Reihe pro Stockwerk, Erdgeschoss ab 0,9 m
    vec2 cell = vec2(fract(uv.x / 3.0), fract((uv.y - 0.2) / levelH));
    float level = floor((uv.y - 0.2) / levelH);
    float inLevels = step(0.0, level) * step(uv.y, levelH * 30.0);
    vec3 glass = vec3(0.30, 0.42, 0.52);
    if (facade < 0.5) {            // Putz: Fenster mit Laibung
      float w = box(cell, vec2(0.30, 0.30), vec2(0.70, 0.78));
      float frame = box(cell, vec2(0.27, 0.27), vec2(0.73, 0.81)) - w;
      col = mix(col, col * 0.78, frame * inLevels);
      col = mix(col, glass, w * inLevels);
    } else if (facade < 1.5) {     // Fachwerk: dunkle Balken + Kreuzstreben + kleine Fenster
      vec3 beam = vec3(0.30, 0.18, 0.10);
      vec2 c2 = vec2(fract(uv.x / 2.0), cell.y);
      float post = 1.0 - step(0.07, c2.x) * step(c2.x, 0.93);
      float rail = 1.0 - step(0.06, c2.y) * step(c2.y, 0.94);
      float diag = 1.0 - step(0.05, abs(c2.x - c2.y));
      float w = box(vec2(fract(uv.x / 4.0), cell.y), vec2(0.62, 0.35), vec2(0.88, 0.75));
      float b = clamp(post + rail + diag * (1.0 - w), 0.0, 1.0) * inLevels;
      col = mix(col, beam, b);
      col = mix(col, glass, w * inLevels);
    } else if (facade < 2.5) {     // Holz: senkrechte Latten, großes Tor im EG
      float plank = smoothstep(0.0, 0.08, fract(uv.x / 0.35)) * smoothstep(1.0, 0.92, fract(uv.x / 0.35));
      col *= 0.82 + 0.18 * plank;
      float door = box(vec2(fract(uv.x / 9.0), uv.y), vec2(0.35, 0.0), vec2(0.65, 3.4));
      col = mix(col, col * 0.55, door);
    } else if (facade < 3.5) {     // Gewerbe: durchgehende Glasbänder
      float band = step(0.25, cell.y) * step(cell.y, 0.85);
      float mullion = 1.0 - step(0.04, fract(uv.x / 1.5));
      col = mix(col, glass * 1.1, band * (1.0 - mullion) * inLevels);
    } else if (facade < 4.5) {     // Öffentlich: hohe Rundbogen-artige Fenster
      vec2 c = vec2(fract(uv.x / 3.5), cell.y);
      float w = box(c, vec2(0.35, 0.18), vec2(0.65, 0.85));
      col = mix(col, glass * 0.9, w * inLevels);
    } else {                       // Schlicht: leichte Fugen
      col *= 0.95 + 0.05 * step(0.04, fract(uv.y / 1.2));
    }
  } else if (facade > 9.5 && facade < 10.5 && detail > 0.5) {
    // Dachziegel: Reihen entlang der Schräge
    float row = fract(uv.y / 0.35);
    float tile = fract(uv.x / 0.3 + step(0.5, fract(uv.y / 0.7)) * 0.5);
    col *= 0.86 + 0.14 * smoothstep(0.0, 0.25, row) * (0.9 + 0.1 * step(0.08, tile));
  }

  vec3 n = normalize(vNormal);
  float diff = max(dot(n, -sunDir), 0.0);
  vec3 hemi = mix(groundColor, skyColor, n.y * 0.5 + 0.5);
  vec3 lit = col * (hemi + sunColor * diff);
  float f = clamp((vDepth - fogRange.x) / (fogRange.y - fogRange.x), 0.0, 1.0);
  gl_FragColor = vec4(mix(lit, fogColor, f), 1.0);
}`;

export interface WorldMaterials {
  terrain: StandardMaterial;
  roads: StandardMaterial;
  buildings: ShaderMaterial;
  buildingsSimple: ShaderMaterial;
  trees: StandardMaterial[];
  updateLighting(sunDir: Vector3, fogStart: number, fogEnd: number, fogColor: Color3): void;
  dispose(): void;
}

function vertexColorMaterial(name: string, scene: Scene): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = Color3.White();
  m.specularColor = Color3.Black();
  m.ambientColor = new Color3(0.55, 0.55, 0.55);
  return m;
}

export function createWorldMaterials(scene: Scene): WorldMaterials {
  const terrain = vertexColorMaterial('terrain', scene);
  const roads = vertexColorMaterial('roads', scene);
  roads.zOffset = -2;
  const mkBuildings = (name: string, detail: number) => {
    const m = new ShaderMaterial(
      name,
      scene,
      { vertexSource: VERTEX, fragmentSource: FRAGMENT },
      {
        attributes: ['position', 'normal', 'color', 'uv', 'uv2'],
        uniforms: [
          'world',
          'view',
          'viewProjection',
          'sunDir',
          'sunColor',
          'skyColor',
          'groundColor',
          'fogColor',
          'fogRange',
          'detail',
        ],
      },
    );
    m.setFloat('detail', detail);
    m.setColor3('sunColor', new Color3(0.78, 0.72, 0.62));
    m.setColor3('skyColor', new Color3(0.62, 0.66, 0.72));
    m.setColor3('groundColor', new Color3(0.36, 0.34, 0.3));
    return m;
  };
  const buildings = mkBuildings('buildings', 1);
  const buildingsSimple = mkBuildings('buildings-simple', 0);
  const trees = [0, 1, 2].map((i) => vertexColorMaterial(`tree${i}`, scene));
  const all = [terrain, roads, buildings, buildingsSimple, ...trees];
  return {
    terrain,
    roads,
    buildings,
    buildingsSimple,
    trees,
    updateLighting(sunDir, fogStart, fogEnd, fogColor) {
      for (const m of [buildings, buildingsSimple]) {
        m.setVector3('sunDir', sunDir.normalizeToNew());
        m.setColor3('fogColor', fogColor);
        m.setVector2('fogRange', new Vector2(fogStart, fogEnd));
      }
    },
    dispose() {
      for (const m of all) m.dispose();
    },
  };
}
