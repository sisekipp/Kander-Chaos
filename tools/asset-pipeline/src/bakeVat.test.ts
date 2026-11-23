import { describe, expect, it } from 'vite-plus/test';
import { Document } from '@gltf-transform/core';
import { bakeVat, compose, invertAffine, mul, toHalf } from './bakeVat.ts';

/** Zwei Gelenke (Wurzel bei y 1, Kind 0,5 darüber), Animation „wave“ dreht das Kind in 1 s um 90° um z. */
function rig(): Document {
  const doc = new Document();
  const buf = doc.createBuffer();
  const acc = (type: 'SCALAR' | 'VEC4' | 'MAT4', arr: number[]) =>
    doc.createAccessor().setType(type).setArray(new Float32Array(arr)).setBuffer(buf);
  const root = doc.createNode('hips').setTranslation([0, 1, 0]);
  const child = doc.createNode('spine').setTranslation([0, 0.5, 0]);
  root.addChild(child);
  // inverse Bindematrizen = Inverse der Ruhelage (Welt)
  const ibm = [
    ...invertAffine(compose([0, 1, 0], [0, 0, 0, 1], [1, 1, 1])),
    ...invertAffine(compose([0, 1.5, 0], [0, 0, 0, 1], [1, 1, 1])),
  ];
  const skin = doc.createSkin('s').addJoint(root).addJoint(child).setInverseBindMatrices(acc('MAT4', ibm));
  const mesh = doc.createNode('mesh').setSkin(skin);
  doc.createScene().addChild(root).addChild(mesh);
  const s = Math.SQRT1_2;
  const sampler = doc
    .createAnimationSampler()
    .setInput(acc('SCALAR', [0, 1]))
    .setOutput(acc('VEC4', [0, 0, 0, 1, 0, 0, s, s]))
    .setInterpolation('LINEAR');
  doc
    .createAnimation('wave')
    .addSampler(sampler)
    .addChannel(doc.createAnimationChannel().setTargetNode(child).setTargetPath('rotation').setSampler(sampler));
  const hold = doc
    .createAnimationSampler()
    .setInput(acc('SCALAR', [0, 0.5]))
    .setOutput(acc('VEC4', [0, 0, 0, 1, 0, 0, 0, 1]));
  doc
    .createAnimation('idle')
    .addSampler(hold)
    .addChannel(doc.createAnimationChannel().setTargetNode(root).setTargetPath('rotation').setSampler(hold));
  return doc;
}

/** Skinning-Matrix von Gelenk `j` in Bild `f`. */
const matAt = (r: ReturnType<typeof bakeVat>, f: number, j: number) =>
  Array.from(r.data.subarray((f * r.width + j * 4) * 4, (f * r.width + j * 4) * 4 + 16));

describe('Gebackene Vertex-Animation', () => {
  it('Layout wie Babylon: (Knochen + 1) · 4 Texel breit, ein Bild je Zeile, Clips nach Namen', () => {
    const r = bakeVat(rig(), 30);
    expect(r.bones).toBe(2);
    expect(r.width).toBe(12);
    expect(r.clips).toEqual({ idle: { from: 0, to: 15 }, wave: { from: 16, to: 46 } });
    expect(r.height).toBe(47);
    expect(r.data.length).toBe(12 * 4 * 47);
    // letzte Matrix je Zeile: Einheitsmatrix
    expect(matAt(r, 20, 2)).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  });

  it('Ruhelage ergibt Einheitsmatrizen, Drehung bewegt Punkte am Kind-Gelenk', () => {
    const r = bakeVat(rig(), 30);
    const id = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    matAt(r, 16, 1).forEach((v, k) => expect(v).toBeCloseTo(id[k], 5));
    // Ende von „wave“: Punkt 0,5 über dem Kind-Gelenk (0, 2, 0) dreht um 90° um z -> (−0,5, 1,5, 0)
    const m = matAt(r, 46, 1);
    const p = mul(m, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 2, 0, 1]).slice(12, 15);
    expect(p[0]).toBeCloseTo(-0.5, 4);
    expect(p[1]).toBeCloseTo(1.5, 4);
    // Wurzel bleibt unbewegt
    matAt(r, 46, 0).forEach((v, k) => expect(v).toBeCloseTo(id[k], 5));
  });

  it('ohne Skelett oder Animation ist es ein Fehler', () => {
    expect(() => bakeVat(new Document())).toThrow(/Skelett/);
  });

  it('Halbfloat: typische Werte und Rundung', () => {
    expect(Array.from(toHalf(new Float32Array([0, 1, -2, 0.5, 65504, 1e-8])))).toEqual([
      0, 0x3c00, 0xc000, 0x3800, 0x7bff, 0,
    ]);
  });
});
