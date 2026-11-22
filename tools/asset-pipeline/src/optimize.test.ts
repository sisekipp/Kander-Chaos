import { describe, expect, it } from 'vite-plus/test';
import { Document } from '@gltf-transform/core';
import { createIO, optimizeDocument } from './optimize.ts';
import { countTriangles } from './validate.ts';

/** Würfel aus 12 Dreiecken mit doppelten Vertices (36 nicht indizierte Ecken). */
function cube(): Document {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const c = [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
    [0, 1, 1],
  ];
  const faces = [
    [0, 1, 2, 0, 2, 3],
    [4, 6, 5, 4, 7, 6],
    [0, 4, 5, 0, 5, 1],
    [3, 2, 6, 3, 6, 7],
    [1, 5, 6, 1, 6, 2],
    [0, 3, 7, 0, 7, 4],
  ].flat();
  const pos = new Float32Array(faces.flatMap((i) => c[i]));
  const acc = doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buffer);
  const mesh = doc
    .createMesh('cube')
    .addPrimitive(doc.createPrimitive().setAttribute('POSITION', acc).setMaterial(doc.createMaterial('m')));
  doc.createScene().addChild(doc.createNode('cube').setMesh(mesh));
  return doc;
}

describe('Optimierung', () => {
  it('verschweißt, quantisiert und komprimiert; Ausgabe lässt sich wieder lesen, Geometrie bleibt erhalten', async () => {
    const doc = cube();
    await optimizeDocument(doc);
    const used = doc
      .getRoot()
      .listExtensionsUsed()
      .map((e) => e.extensionName);
    expect(used).toContain('KHR_mesh_quantization');
    expect(used).toContain('EXT_meshopt_compression');
    const io = await createIO();
    const glb = await io.writeBinary(doc);
    const back = await io.readBinary(glb);
    expect(countTriangles(back)).toBe(12);
    const prim = back.getRoot().listMeshes()[0].listPrimitives()[0];
    expect(prim.getAttribute('POSITION')!.getCount()).toBe(8); // verschweißt
    // Quantisierte Positionen spannen weiterhin den Einheitswürfel auf
    const p = prim.getAttribute('POSITION')!;
    const max = [0, 0, 0];
    for (let i = 0; i < p.getCount(); i++) p.getElement(i, []).forEach((v, k) => (max[k] = Math.max(max[k], v)));
    const node = back.getRoot().listNodes()[0];
    const s = node.getScale();
    const t = node.getTranslation();
    max.forEach((v, k) => expect(v * s[k] + t[k]).toBeCloseTo(1, 2));
  });
});
