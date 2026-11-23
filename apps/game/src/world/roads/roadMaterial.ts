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
varying vec3 vNormal;
varying vec2 vRoad;
varying vec2 vCode;
varying vec2 vWorld;
varying float vDepth;
void main(void) {
  vec4 wp = world * vec4(position, 1.0);
  gl_Position = viewProjection * wp;
  vNormal = normalize(mat3(world) * normal);
  vRoad = uv;
  vCode = uv2;
  vWorld = wp.xz;
  vDepth = (view * wp).z;
}`;

/**
 * Straßen-Shader: alle Straßenteile einer Kachel in einem Mesh. Codes wie `RoadCode` in profile.ts.
 * uv = (Querlage, Längsposition) in m; uv2 = (Code, Markierung kodiert wie encodeMarking).
 */
const FRAGMENT = /* glsl */ `
#extension GL_OES_standard_derivatives : enable
precision highp float;
varying vec3 vNormal;
varying vec2 vRoad;
varying vec2 vCode;
varying vec2 vWorld;
varying float vDepth;
${LIGHTING_GLSL}
${NOISE_GLSL}

/** Linie bei x = c mit halber Breite hw, geglättet über die Bildschirmableitung. */
float kcLine(float x, float c, float hw) {
  float aa = max(fwidth(x), 1e-4);
  return 1.0 - smoothstep(hw - aa, hw + aa, abs(x - c));
}
/** Strichmuster entlang y: Anteil duty einer Periode. In der Ferne zum Mittelwert ausgeblendet. */
float kcDash(float y, float period, float duty) {
  float f = fract(y / period);
  float aa = max(fwidth(y) / period, 1e-4);
  float d = smoothstep(0.0, aa, f) * (1.0 - smoothstep(duty - aa, duty + aa, f));
  return mix(d, duty, smoothstep(0.15, 0.45, aa));
}
/** Fugenraster mit Kantenlänge (sx, sy), Fugenbreite w in m. */
float kcJoints(vec2 p, vec2 size, float w) {
  vec2 g = abs(fract(p / size) - 0.5) * size;
  vec2 aa = max(fwidth(p), vec2(1e-4));
  vec2 j = 1.0 - smoothstep(size * 0.5 - w - aa, size * 0.5 - w + aa, g);
  return 1.0 - j.x * j.y;
}

void main(void) {
  float code = floor(vCode.x + 0.5);
  float x = vRoad.x, y = vRoad.y;
  float n = kcFbm2(vWorld * 2.3);
  vec3 asphalt = vec3(0.38, 0.385, 0.4) * (0.95 + 0.08 * n);
  vec3 white = vec3(0.93);
  vec3 col = asphalt;

  if (code < 1.5 || (code > 6.5 && code < 7.5)) {
    // Asphalt: ein Grundton für Fahrbahnen, Kreuzungen und Kreisverkehre (keine sichtbaren Kanten)
    if (code < 1.5) {
      float hi = floor(vCode.y / 100.0 + 1e-3);
      float marking = mod(hi, 10.0);
      float lanes = floor(hi / 10.0 + 1e-3);
      float hw = vCode.y - hi * 100.0;
      float m = 0.0;
      if (marking > 0.5 && marking < 2.5) m = kcLine(x, 0.0, 0.06) * kcDash(y, 9.0, 0.333);
      if (marking > 1.5) {
        m = max(m, kcLine(x, -hw + 0.3, 0.06));
        m = max(m, kcLine(x, hw - 0.3, 0.06));
      }
      if (marking > 2.5 && lanes > 1.5) {
        float lw = 2.0 * hw / lanes;
        for (int k = 1; k < 6; k++) {
          if (float(k) >= lanes) break;
          m = max(m, kcLine(x, -hw + lw * float(k), 0.07) * kcDash(y, 18.0, 0.333));
        }
      }
      col = mix(col, white, m);
    }
  } else if (code < 2.5) {
    // Feldweg: Schotterspuren, Grasstreifen in der Mitte
    vec3 gravel = vec3(0.62, 0.56, 0.45) * (0.85 + 0.3 * n);
    vec3 grass = vec3(0.4, 0.55, 0.28) * (0.85 + 0.3 * kcNoise(vWorld * 2.0));
    float mid = 1.0 - smoothstep(0.3, 0.55, abs(x));
    col = mix(gravel, grass, mid);
  } else if (code < 3.5) {
    // Fußweg gepflastert: kleine Steine
    col = vec3(0.64, 0.61, 0.56) * (0.9 + 0.15 * n);
    col *= 1.0 - 0.18 * kcJoints(vec2(x, y), vec2(0.2, 0.2), 0.012);
  } else if (code < 4.5) {
    col = vec3(0.55, 0.3, 0.27) * (0.9 + 0.15 * n); // Radweg rötlich
  } else if (code < 5.5) {
    col = vec3(0.66, 0.65, 0.62); // Bordstein
  } else if (code < 6.5) {
    // Gehweg: Betonplatten 30 cm
    col = vec3(0.6, 0.59, 0.56) * (0.95 + 0.08 * n);
    col *= 1.0 - 0.12 * kcJoints(vec2(x, y), vec2(0.3, 0.3), 0.01);
  } else if (code < 8.5) {
    // Zebrastreifen: Balken 50 cm in Laufrichtung, Abstand 50 cm
    float bar = kcDash(x + 0.25, 1.0, 0.5);
    float inside = 1.0 - smoothstep(1.3, 1.4, abs(y));
    col = mix(asphalt, white, bar * inside);
  } else if (code < 9.5) {
    col = vec3(0.7, 0.72, 0.74); // Leitplanke
  } else if (code < 10.5) {
    col = vec3(0.7, 0.68, 0.64) * (0.92 + 0.12 * n); // Beton
  } else if (code < 11.5) {
    col = vec3(0.52, 0.42, 0.3) * (0.85 + 0.3 * n); // Erde
  } else if (code < 12.5) {
    col = vec3(0.64, 0.6, 0.52) * (0.85 + 0.3 * n); // Schotter
  } else if (code < 13.5) {
    // Gleise: Schotter, je Gleis (Abstand 3,5 m) Schwellen alle 0,6 m und Schienen bei ±0,75 m
    float tracks = max(1.0, floor(floor(vCode.y / 100.0 + 1e-3) / 10.0 + 1e-3));
    float xt = mod(x + tracks * 1.75, 3.5) - 1.75;
    col = vec3(0.5, 0.48, 0.45) * (0.8 + 0.4 * n);
    float sleeper = kcDash(y, 0.6, 0.4) * (1.0 - smoothstep(1.2, 1.3, abs(xt)));
    col = mix(col, vec3(0.38, 0.3, 0.24), sleeper);
    float rail = max(kcLine(xt, -0.75, 0.04), kcLine(xt, 0.75, 0.04));
    col = mix(col, vec3(0.62, 0.62, 0.64), rail);
  } else if (code < 14.5) {
    // Kopfsteinpflaster im Ortskern
    col = vec3(0.5, 0.48, 0.45) * (0.85 + 0.3 * kcNoise(floor(vRoad / 0.12) * 1.7));
    col *= 1.0 - 0.25 * kcJoints(vec2(x, y), vec2(0.12, 0.14), 0.012);
  } else if (code < 15.5) {
    col = vec3(0.3, 0.52, 0.66) * (0.9 + 0.15 * n); // Wasser (vorläufig)
  } else if (code < 16.5) {
    col = vec3(0.42, 0.6, 0.3) * (0.88 + 0.24 * kcFbm2(vWorld * 0.5)); // Rasen (Mittelinsel)
  } else {
    float hw = vCode.y - floor(vCode.y / 100.0 + 1e-3) * 100.0;
    if (code < 17.5) {
      // Piste: heller Beton, Mittellinie gestrichelt (30 m / 20 m), Randlinien
      col = vec3(0.56, 0.56, 0.55) * (0.92 + 0.12 * n);
      float m = kcLine(x, 0.0, 0.45) * kcDash(y, 50.0, 0.6);
      m = max(m, kcLine(x, -hw + 1.5, 0.45));
      m = max(m, kcLine(x, hw - 1.5, 0.45));
      col = mix(col, white, m);
    } else {
      // Rollweg: Asphalt, gelbe Mittellinie
      col = asphalt * 0.95;
      col = mix(col, vec3(0.92, 0.75, 0.15), kcLine(x, 0.0, 0.5)); // breiter als echt (0,15 m), damit aus der Luft sichtbar
    }
  }
  vec3 nrm = normalize(vNormal);
  gl_FragColor = vec4(kcFinish(col * kcLight(nrm), vDepth), 1.0);
}`;

/** Material für alle Straßenteile einer Kachel (ein Draw Call je Kachel). */
export function createRoadMaterial(scene: Scene): ShaderMaterial {
  const m = new ShaderMaterial(
    'roads',
    scene,
    { vertexSource: VERTEX, fragmentSource: FRAGMENT },
    {
      attributes: ['position', 'normal', 'uv', 'uv2'],
      uniforms: ['world', 'view', 'viewProjection', ...LIGHTING_UNIFORMS],
    },
  );
  m.zOffset = -2;
  return m;
}
