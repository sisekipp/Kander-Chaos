import { describe, expect, it } from 'vite-plus/test';
import { Document } from '@gltf-transform/core';
import { FIXED_MATERIAL, applyColorZones, zoneMaterialName } from './recolor.ts';

/** Kleines Testmodell: drei Teile mit eigenen Materialien (Karosserie rot, Glas blau, Reifen schwarz). */
function carDoc(): Document {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const mesh = doc.createMesh('car');
  for (const [name, color] of [
    ['Car_Body', [0.8, 0.1, 0.1, 1]],
    ['Glass', [0.3, 0.5, 0.8, 1]],
    ['Tire', [0.05, 0.05, 0.05, 1]],
  ] as const) {
    const pos = doc
      .createAccessor()
      .setType('VEC3')
      .setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
      .setBuffer(buffer);
    const mat = doc.createMaterial(name).setBaseColorFactor([...color]);
    mesh.addPrimitive(doc.createPrimitive().setAttribute('POSITION', pos).setMaterial(mat));
  }
  doc.createScene().addChild(doc.createNode('car').setMesh(mesh));
  return doc;
}

describe('Farbzonen', () => {
  it('Lack wird zur Farbzone, übrige Farben werden als Vertex-Farbe eingebacken', () => {
    const doc = carDoc();
    const r = applyColorZones(doc, { paint: ['body'] });
    expect(r.zones).toEqual(['paint']);
    const names = doc
      .getRoot()
      .listMaterials()
      .map((m) => m.getName())
      .sort();
    expect(names).toEqual([FIXED_MATERIAL, zoneMaterialName('paint')].sort());
    const [body, glass, tire] = doc.getRoot().listMeshes()[0].listPrimitives();
    expect(body.getMaterial()!.getName()).toBe('zone_paint');
    expect(Array.from(body.getAttribute('COLOR_0')!.getElement(0, []))).toEqual([1, 1, 1, 1]);
    expect(glass.getMaterial()!.getName()).toBe(FIXED_MATERIAL);
    expect(glass.getAttribute('COLOR_0')!.getElement(2, [])[2]).toBeCloseTo(0.8);
    expect(tire.getAttribute('COLOR_0')!.getElement(0, [])[0]).toBeCloseTo(0.05);
  });

  it('Zuordnung ohne Groß-/Kleinschreibung, mehrere Zonen', () => {
    const doc = carDoc();
    const r = applyColorZones(doc, { paint: ['BODY'], glass: ['glass'] });
    expect(r.zones).toEqual(['glass', 'paint']);
    expect(r.materials).toBe(3);
  });

  it('ohne Zonen: ein einziges Material, alle Farben eingebacken', () => {
    const doc = carDoc();
    expect(applyColorZones(doc, {}).materials).toBe(1);
  });
});
