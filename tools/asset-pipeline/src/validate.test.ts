import { describe, expect, it } from 'vite-plus/test';
import { Document } from '@gltf-transform/core';
import {
  HELICOPTER_TRIANGLES,
  MODELS_BUDGET,
  checkBudget,
  countTriangles,
  detachableParts,
  validateModel,
} from './validate.ts';

/** Modell mit `tris` Dreiecken, `mats` Materialien und den angegebenen Knotennamen. */
function model(tris: number, mats = 1, nodes: string[] = []): Document {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const mesh = doc.createMesh('m');
  for (let m = 0; m < mats; m++) {
    const n = Math.ceil(tris / mats) * 3;
    const pos = doc
      .createAccessor()
      .setType('VEC3')
      .setArray(new Float32Array(n * 3))
      .setBuffer(buffer);
    mesh.addPrimitive(
      doc
        .createPrimitive()
        .setAttribute('POSITION', pos)
        .setMaterial(doc.createMaterial(`m${m}`)),
    );
  }
  const scene = doc.createScene();
  scene.addChild(doc.createNode('root').setMesh(mesh));
  for (const n of nodes) scene.addChild(doc.createNode(n));
  return doc;
}

describe('Prüfregeln für Modelle', () => {
  it('zählt Dreiecke je gezeichnetem Knoten (geteilte Meshes mehrfach)', () => {
    const doc = model(120);
    expect(countTriangles(doc)).toBe(120);
    const mesh = doc.getRoot().listMeshes()[0];
    doc.getRoot().listScenes()[0].addChild(doc.createNode('kopie').setMesh(mesh));
    expect(countTriangles(doc)).toBe(240);
  });

  it('Dreiecksgrenze je Art: Prop über 600 fällt durch, Wahrzeichen bis 8.000 erlaubt', () => {
    expect(validateModel('bank', 'prop', model(700))[0]).toContain('700 Dreiecke > 600');
    expect(validateModel('kirche', 'landmark', model(7000))).toEqual([]);
    expect(validateModel('figur', 'figure', model(3200))[0]).toContain('> 3000');
  });

  it('Hubschrauber darf bis 6.000 Dreiecke haben (eigene Grenze), Autos nur 2.500', () => {
    const doc = model(3500);
    expect(validateModel('heli', 'vehicle', doc, HELICOPTER_TRIANGLES).some((e) => e.includes('Dreiecke'))).toBe(false);
    expect(validateModel('auto', 'vehicle', doc).some((e) => e.includes('Dreiecke'))).toBe(true);
  });

  it('Materialanzahl: Wahrzeichen höchstens 2', () => {
    expect(validateModel('kirche', 'landmark', model(100, 3))[0]).toContain('3 Materialien > 2');
  });

  it('Fahrzeuge brauchen mindestens 2 lösbare Teile (detach_*)', () => {
    expect(validateModel('auto', 'vehicle', model(100, 2, ['detach_door_l']))[0]).toContain('nur 1 lösbare Teile');
    expect(validateModel('auto', 'vehicle', model(100, 2, ['detach_door_l', 'Detach_Bumper']))).toEqual([]);
    expect(detachableParts(model(10, 1, ['wheel_fl', 'detach_hood']))).toEqual(['detach_hood']);
  });

  it('Budget 15 MB für alle Modelle', () => {
    expect(checkBudget({ a: 5e6, b: 5e6 }).ok).toBe(true);
    const over = checkBudget({ a: MODELS_BUDGET, b: 1 });
    expect(over.ok).toBe(false);
    expect(over.message).toContain('Budget überschritten');
  });
});
