import { describe, expect, it } from 'vite-plus/test';
import { Document } from '@gltf-transform/core';
import { FIXED_MATERIAL } from './recolor.ts';
import { splitParts } from './split.ts';
import { bakePaletteTexture, detectPaint, hue, isPaintShade } from './texbake.ts';
import { encodePng } from './testPng.ts';

/**
 * Testauto: Karosserie aus 3 Dreiecken (2 rot = Lack, 1 hellgrau = Fenster) und ein Rad (schwarz),
 * Farben über eine 2×2-Paletten-Textur (rot, grau, schwarz, weiß).
 */
function car(): Document {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const img = encodePng(2, 2, [
    [200, 40, 30],
    [200, 200, 210],
    [20, 20, 20],
    [255, 255, 255],
  ]);
  const tex = doc.createTexture('colormap').setImage(img).setMimeType('image/png');
  const mat = doc.createMaterial('colormap').setBaseColorTexture(tex);
  const prim = (positions: number[], uvs: number[]) =>
    doc
      .createPrimitive()
      .setMaterial(mat)
      .setAttribute(
        'POSITION',
        doc.createAccessor().setType('VEC3').setArray(new Float32Array(positions)).setBuffer(buffer),
      )
      .setAttribute(
        'TEXCOORD_0',
        doc.createAccessor().setType('VEC2').setArray(new Float32Array(uvs)).setBuffer(buffer),
      );
  const red = [0.25, 0.25, 0.25, 0.25, 0.25, 0.25],
    grey = [0.75, 0.25, 0.75, 0.25, 0.75, 0.25],
    black = [0.25, 0.75, 0.25, 0.75, 0.25, 0.75];
  // Dreieck 0: vorne (z ≈ 1), Dreieck 1: hinten (z ≈ -1), Dreieck 2: Fenster oben
  const body = doc
    .createMesh('body')
    .addPrimitive(
      prim(
        [0, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, -1, 1, 0, -1, 0, 1, -1, 0, 2, 0, 1, 2, 0, 0, 3, 0],
        [...red, ...red, ...grey],
      ),
    );
  const wheel = doc.createMesh('wheel').addPrimitive(prim([0, 0, 0, 1, 0, 0, 0, 1, 0], black));
  const scene = doc.createScene();
  scene.addChild(doc.createNode('body').setMesh(body));
  scene.addChild(doc.createNode('wheel-front-left').setMesh(wheel));
  return doc;
}

describe('Paletten-Textur einbacken', () => {
  it('Lackfarbe automatisch erkannt (häufigste bunte Farbe), Fenster und Rad behalten ihre Farbe', async () => {
    const doc = car();
    const { paint } = await bakePaletteTexture(doc, { paintNode: 'body' });
    expect(paint!.map((v) => Math.round(v * 255))).toEqual([200, 40, 30]);
    const mats = doc
      .getRoot()
      .listMaterials()
      .map((m) => m.getName())
      .sort();
    expect(mats).toEqual([FIXED_MATERIAL, 'zone_paint'].sort());
    expect(doc.getRoot().listTextures()).toHaveLength(0);
    const body = doc
      .getRoot()
      .listMeshes()
      .find((m) => m.getName() === 'body')!;
    const paintPrim = body.listPrimitives().find((p) => p.getMaterial()!.getName() === 'zone_paint')!;
    expect(paintPrim.getAttribute('POSITION')!.getCount()).toBe(6);
    expect(paintPrim.getAttribute('TEXCOORD_0')).toBeNull();
    const glass = body.listPrimitives().find((p) => p.getMaterial()!.getName() === FIXED_MATERIAL)!;
    expect(Math.round(glass.getAttribute('COLOR_0')!.getElement(0, [])[2] * 255)).toBe(210);
    const wheel = doc
      .getRoot()
      .listMeshes()
      .find((m) => m.getName() === 'wheel')!;
    expect(wheel.listPrimitives()[0].getMaterial()!.getName()).toBe(FIXED_MATERIAL);
  });

  it('unbunte Farben werden nie zur Lackfarbe', () => {
    expect(
      detectPaint(
        [
          [0.8, 0.8, 0.82],
          [0.1, 0.1, 0.1],
        ],
        [10, 10],
      ),
    ).toBeNull();
  });
});

describe('Lösbare Teile abtrennen', () => {
  it('Dreiecke im Bereich werden zu eigenen detach_-Knoten mit gleicher Lage', async () => {
    const doc = car();
    await bakePaletteTexture(doc, { paintNode: 'body' });
    const r = splitParts(doc, [
      { name: 'detach_bumper_front', from: 'body', min: [-5, -5, 0.5], max: [5, 5, 5] },
      { name: 'detach_bumper_back', from: 'body', min: [-5, -5, -5], max: [5, 5, -0.5] },
      { name: 'detach_nothing', from: 'body', min: [50, 50, 50], max: [60, 60, 60] },
    ]);
    expect(r).toEqual({ detach_bumper_front: 1, detach_bumper_back: 1, detach_nothing: 0 });
    const names = doc
      .getRoot()
      .listNodes()
      .map((n) => n.getName());
    expect(names).toContain('detach_bumper_front');
    expect(names).not.toContain('detach_nothing');
    const body = doc
      .getRoot()
      .listNodes()
      .find((n) => n.getName() === 'body')!
      .getMesh()!;
    const remaining = body.listPrimitives().reduce((s, p) => s + p.getAttribute('POSITION')!.getCount() / 3, 0);
    expect(remaining).toBe(1); // nur das Fenster bleibt an der Karosserie
  });

  it('unbekannter Quellknoten ist ein Fehler', () => {
    expect(() =>
      splitParts(car(), [{ name: 'detach_x', from: 'gibtsnicht', min: [0, 0, 0], max: [1, 1, 1] }]),
    ).toThrow();
  });
});

describe('Lack in mehreren Helligkeitsstufen', () => {
  it('dunklere Stufe desselben Farbtons gehört zum Lack, andere Farbtöne und Grau nicht', () => {
    const paint: [number, number, number] = [0.2, 0.35, 0.8];
    expect(isPaintShade([0.12, 0.21, 0.5], paint)).toBe(true);
    expect(isPaintShade([0.8, 0.2, 0.2], paint)).toBe(false);
    expect(isPaintShade([0.5, 0.5, 0.52], paint)).toBe(false);
    expect(hue([1, 0, 0])).toBe(0);
    expect(hue([0, 0, 1])).toBeCloseTo(2 / 3);
  });
});
