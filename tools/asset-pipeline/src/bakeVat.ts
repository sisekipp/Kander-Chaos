import type { Animation, AnimationSampler, Document, Node } from '@gltf-transform/core';

/**
 * Gebackene Vertex-Animation (VAT) für NPC-Figuren (Design D6): je Bild und Knochen die Skinning-Matrix
 * (Gelenk-Weltlage × inverse Bindematrix) als 4 RGBA-Texel – genau das Layout von Babylons
 * `BakedVertexAnimationManager`: Breite (Knochen + 1) · 4 Texel, eine Zeile je Bild, Spaltenvektoren.
 * Im Spiel braucht die Figur dann keine Skelettberechnung auf der CPU, viele Figuren laufen mit Thin Instances.
 */

export interface VatClip {
  /** Erstes und letztes Bild in der Textur (einschließlich). */
  from: number;
  to: number;
}

export interface VatResult {
  width: number;
  height: number;
  fps: number;
  /** RGBA-Daten, Zeile für Zeile. */
  data: Float32Array;
  clips: Record<string, VatClip>;
  bones: number;
}

type V3 = [number, number, number];
type Q = [number, number, number, number];

function slerp(a: Q, b: Q, t: number): Q {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const s = d < 0 ? -1 : 1;
  d = Math.abs(d);
  let k0 = 1 - t,
    k1 = t * s;
  if (d < 0.9995) {
    const th = Math.acos(d),
      sin = Math.sin(th);
    k0 = Math.sin((1 - t) * th) / sin;
    k1 = (Math.sin(t * th) / sin) * s;
  }
  const q: Q = [a[0] * k0 + b[0] * k1, a[1] * k0 + b[1] * k1, a[2] * k0 + b[2] * k1, a[3] * k0 + b[3] * k1];
  const n = Math.hypot(...q);
  return q.map((v) => v / n) as Q;
}

/** Wert eines Samplers zur Zeit t (LINEAR bzw. STEP; Blender exportiert abgetastet und linear). */
export function sample(s: AnimationSampler, t: number, rotation: boolean): number[] {
  const times = s.getInput()!.getArray()!;
  const out = s.getOutput()!;
  const n = out.getElementSize();
  const at = (i: number): number[] => out.getElement(i, []);
  if (t <= times[0]) return at(0);
  const last = times.length - 1;
  if (t >= times[last]) return at(last);
  let i = 0;
  while (times[i + 1] < t) i++;
  if (s.getInterpolation() === 'STEP') return at(i);
  const f = (t - times[i]) / (times[i + 1] - times[i]);
  const a = at(i),
    b = at(i + 1);
  if (rotation && n === 4) return slerp(a as Q, b as Q, f);
  return a.map((v, k) => v + (b[k] - v) * f);
}

/** Spaltenweise 4×4-Matrix aus Translation, Rotation (x, y, z, w) und Skalierung. */
export function compose(t: V3, q: Q, s: V3): number[] {
  const [x, y, z, w] = q;
  const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z; // prettier-ignore
  return [
    (1 - 2 * (yy + zz)) * s[0], 2 * (xy + wz) * s[0], 2 * (xz - wy) * s[0], 0,
    2 * (xy - wz) * s[1], (1 - 2 * (xx + zz)) * s[1], 2 * (yz + wx) * s[1], 0,
    2 * (xz + wy) * s[2], 2 * (yz - wx) * s[2], (1 - 2 * (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ]; // prettier-ignore
}

/** a · b für spaltenweise 4×4-Matrizen. */
export function mul(a: number[], b: number[]): number[] {
  const o: number[] = Array.from({ length: 16 }, () => 0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let v = 0;
      for (let k = 0; k < 4; k++) v += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = v;
    }
  return o;
}

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** Lokale Matrix eines Knotens zur Zeit t (animierte Kanäle der Animation, sonst Ruhelage). */
function localAt(node: Node, anim: Animation | null, t: number): number[] {
  let tr = node.getTranslation() as V3,
    rot = node.getRotation() as Q,
    sc = node.getScale() as V3;
  for (const ch of anim?.listChannels() ?? []) {
    if (ch.getTargetNode() !== node) continue;
    const s = ch.getSampler()!;
    const path = ch.getTargetPath();
    if (path === 'translation') tr = sample(s, t, false) as V3;
    else if (path === 'rotation') rot = sample(s, t, true) as Q;
    else if (path === 'scale') sc = sample(s, t, false) as V3;
  }
  return compose(tr, rot, sc);
}

function worldAt(node: Node, anim: Animation | null, t: number): number[] {
  let m = localAt(node, anim, t);
  for (let p = node.getParentNode(); p; p = p.getParentNode()) m = mul(localAt(p, anim, t), m);
  return m;
}

/** Dauer einer Animation in s (letzter Zeitpunkt aller Sampler). */
function duration(a: Animation): number {
  let d = 0;
  for (const s of a.listSamplers()) {
    const arr = s.getInput()!.getArray()!;
    d = Math.max(d, arr[arr.length - 1]);
  }
  return d;
}

/**
 * Backt alle Animationen (nach Namen sortiert) der ersten Haut in eine VAT. Jede Animation belegt die Bilder
 * `from … to` (Dauer · fps + 1 Bilder). Die letzte Matrix je Zeile ist die Einheitsmatrix (Babylon-Layout).
 */
export function bakeVat(doc: Document, fps = 30): VatResult {
  const skin = doc.getRoot().listSkins()[0];
  if (!skin) throw new Error('VAT: Modell ohne Skelett');
  const joints = skin.listJoints();
  const ibmAcc = skin.getInverseBindMatrices();
  const ibm = joints.map((_, i) => (ibmAcc ? ibmAcc.getElement(i, []) : IDENTITY));
  // Gelenke relativ zum Mesh-Knoten (glTF: inverse Weltlage des Mesh-Knotens)
  const meshNode = doc
    .getRoot()
    .listNodes()
    .find((n) => n.getSkin() === skin);
  const anims = [...doc.getRoot().listAnimations()].sort((a, b) => a.getName().localeCompare(b.getName()));
  if (!anims.length) throw new Error('VAT: Modell ohne Animationen');
  const clips: Record<string, VatClip> = {};
  let frames = 0;
  for (const a of anims) {
    const n = Math.round(duration(a) * fps) + 1;
    clips[a.getName()] = { from: frames, to: frames + n - 1 };
    frames += n;
  }
  const width = (joints.length + 1) * 4;
  const data = new Float32Array(width * 4 * frames);
  for (const a of anims) {
    const { from, to } = clips[a.getName()];
    for (let f = from; f <= to; f++) {
      const t = (f - from) / fps;
      const inv = meshNode ? invertAffine(worldAt(meshNode, a, t)) : IDENTITY;
      joints.forEach((j, i) => data.set(mul(inv, mul(worldAt(j, a, t), ibm[i])), (f * width + i * 4) * 4));
      data.set(IDENTITY, (f * width + joints.length * 4) * 4);
    }
  }
  return { width, height: frames, fps, data, clips, bones: joints.length };
}

/** Inverse einer affinen Matrix (Rotation/Skalierung + Translation). */
export function invertAffine(m: number[]): number[] {
  const [a, b, c, , d, e, f, , g, h, i] = m;
  const det = a * (e * i - f * h) - d * (b * i - c * h) + g * (b * f - c * e);
  const r = [
    (e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det,
    (f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det,
    (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det,
  ]; // prettier-ignore
  const [tx, ty, tz] = [m[12], m[13], m[14]];
  return [
    r[0], r[1], r[2], 0, r[3], r[4], r[5], 0, r[6], r[7], r[8], 0,
    -(r[0] * tx + r[3] * ty + r[6] * tz), -(r[1] * tx + r[4] * ty + r[7] * tz), -(r[2] * tx + r[5] * ty + r[8] * tz), 1,
  ]; // prettier-ignore
}

/** Float32 -> IEEE-Halbfloat (Uint16), für RGBA16F-Texturen (halber Speicher, auf dem iPad schnell lesbar). */
export function toHalf(src: Float32Array): Uint16Array {
  const out = new Uint16Array(src.length);
  const f = new Float32Array(1),
    u = new Uint32Array(f.buffer);
  for (let k = 0; k < src.length; k++) {
    f[0] = src[k];
    const x = u[0];
    const sign = (x >>> 16) & 0x8000;
    const exp = ((x >>> 23) & 0xff) - 127 + 15;
    const mant = x & 0x7fffff;
    if (exp <= 0) out[k] = exp < -10 ? sign : sign | ((mant | 0x800000) >> (1 - exp + 13));
    else if (exp >= 31) out[k] = sign | 0x7c00;
    else out[k] = sign | ((exp << 10) + ((mant + 0x1000) >> 13)); // Rundung darf in den Exponenten übertragen
  }
  return out;
}
