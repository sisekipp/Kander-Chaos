import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import type { Scene } from '@babylonjs/core/scene';
import { LIGHTING_GLSL, LIGHTING_UNIFORMS } from '../shaders/lighting.glsl.ts';

/**
 * Fassaden prozedural im Fragment-Shader statt per Texturatlas: Fenster, Fachwerkbalken,
 * Holzlatten, Glasbänder und Dachziegel entstehen aus uv (Meter) und uv2.x (Fassadentyp).
 * Vorteil: 0 Byte Texturdaten, ein Material für alle Gebäude, beliebig skalierbar.
 */
export const BUILDING_VERTEX = /* glsl */ `
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

export const BUILDING_FRAGMENT = /* glsl */ `
precision highp float;
varying vec3 vNormal;
varying vec4 vColor;
varying vec2 vUV;
varying vec2 vUV2;
varying float vDepth;
uniform float detail;
${LIGHTING_GLSL}

float box(vec2 p, vec2 lo, vec2 hi) {
  vec2 s = step(lo, p) * step(p, hi);
  return s.x * s.y;
}

void main(void) {
  vec3 base = vColor.rgb;
  float code = floor(vUV2.x + 0.5);
  float shutter = floor(code / 100.0 + 0.001);   // 0 keine, 1 grün, 2 rot, 3 grau
  float facade = code - shutter * 100.0;
  vec3 shutterCol = shutter < 1.5 ? vec3(0.22, 0.4, 0.27) : shutter < 2.5 ? vec3(0.55, 0.21, 0.17) : vec3(0.5, 0.52, 0.54);
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
    if (facade > 5.5 && facade < 6.5) {   // Haustür: Holzrahmen, Füllungen, Oberlicht
      vec3 wood = vec3(0.42, 0.26, 0.15);
      float frame = 1.0 - box(uv, vec2(0.08, 0.0), vec2(0.92, 0.94));
      float panel = box(fract(uv * vec2(2.0, 3.0)), vec2(0.15, 0.12), vec2(0.85, 0.88));
      col = wood * (0.8 + 0.12 * panel);
      col = mix(col, wood * 0.6, frame);
      col = mix(col, glass, box(uv, vec2(0.2, 0.8), vec2(0.8, 0.9)));
    } else if (facade > 6.5 && facade < 7.5) {   // Kirchenschiff: hohe Rundbogenfenster, Sandsteinsockel
      float cx = fract(uv.x / 4.0) - 0.5;
      float topY = levelH - 1.4;
      float hw = 0.45;
      float inX = step(abs(cx * 4.0), hw);
      float arch = step(length(vec2(cx * 4.0, max(uv.y - (topY - hw), 0.0))), hw);
      float w = inX * step(2.2, uv.y) * step(uv.y, topY) * arch;
      col = mix(col, vec3(0.24, 0.3, 0.38), w);
      col = mix(col, vec3(0.62, 0.38, 0.31), step(uv.y, 0.6));
    } else if (facade > 7.5 && facade < 8.5) {   // Kirchturm: Schallöffnungen oben, schmale Fenster, Ecksteine
      float x = uv.x;   // 0 … 1 je Turmseite
      float H = levelH;
      float hw = 0.12;
      float inX = step(abs(x - 0.5), hw);
      float topY = H - 2.2;
      float arch = step(length(vec2((x - 0.5), max(uv.y - (topY - hw), 0.0) / 3.0)), hw);
      float sound = inX * step(H - 5.0, uv.y) * step(uv.y, topY) * arch;
      float slit = step(abs(x - 0.5), 0.04) * step(0.6, fract(uv.y / 6.0)) * step(uv.y, H - 7.0) * step(3.0, uv.y);
      col = mix(col, vec3(0.62, 0.38, 0.31), (step(x, 0.06) + step(0.94, x)) * 0.8); // Ecksteine
      col = mix(col, vec3(0.12, 0.1, 0.1), max(sound, slit));
      col = mix(col, vec3(0.62, 0.38, 0.31), step(uv.y, 0.6));
    } else if (facade < 0.5) {            // Putz: Fenster mit Laibung, Fensterläden, Sandsteinsockel
      float w = box(cell, vec2(0.30, 0.30), vec2(0.70, 0.78));
      float frame = box(cell, vec2(0.27, 0.27), vec2(0.73, 0.81)) - w;
      col = mix(col, col * 0.78, frame * inLevels);
      col = mix(col, glass, w * inLevels);
      if (shutter > 0.5) {
        float sh = box(cell, vec2(0.15, 0.30), vec2(0.265, 0.78)) + box(cell, vec2(0.735, 0.30), vec2(0.85, 0.78));
        float slats = 0.85 + 0.15 * step(0.5, fract(uv.y * 14.0));
        col = mix(col, shutterCol * slats, sh * inLevels);
      }
      col = mix(col, vec3(0.62, 0.38, 0.31) * 0.95, step(uv.y, 0.5));
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
      if (shutter > 0.5) {
        vec2 c4 = vec2(fract(uv.x / 4.0), cell.y);
        float sh = box(c4, vec2(0.555, 0.35), vec2(0.615, 0.75)) + box(c4, vec2(0.885, 0.35), vec2(0.945, 0.75));
        col = mix(col, shutterCol, sh * inLevels);
      }
      col = mix(col, vec3(0.62, 0.38, 0.31) * 0.95, step(uv.y, 0.5));
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
  gl_FragColor = vec4(kcFinish(col * kcLight(n), vDepth), 1.0);
}`;

/** Gebäudematerial (detail 1 = Ring 0 mit Fassadenmustern, 0 = vereinfacht). */
export function createBuildingMaterial(scene: Scene, name: string, detail: number): ShaderMaterial {
  const m = new ShaderMaterial(
    name,
    scene,
    { vertexSource: BUILDING_VERTEX, fragmentSource: BUILDING_FRAGMENT },
    {
      attributes: ['position', 'normal', 'color', 'uv', 'uv2'],
      uniforms: ['world', 'view', 'viewProjection', 'detail', ...LIGHTING_UNIFORMS],
    },
  );
  m.setFloat('detail', detail);
  return m;
}
