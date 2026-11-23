import { describe, expect, it } from 'vite-plus/test';
import { Document } from '@gltf-transform/core';
import { scaleScene, vehicleDims } from './vehicleDims.ts';

/** Karosserie 1,5 × 1 × 2,5 m bei y 0,15 … 1,15 und zwei Räder (Radius 0,3). */
function car(): Document {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const box = (x: number, y: number, z: number) =>
    doc.createMesh().addPrimitive(
      doc.createPrimitive().setAttribute(
        'POSITION',
        doc
          .createAccessor()
          .setType('VEC3')
          .setArray(new Float32Array([-x, -y, -z, x, y, z, -x, y, z]))
          .setBuffer(buffer),
      ),
    );
  const scene = doc.createScene();
  scene.addChild(
    doc
      .createNode('body')
      .setMesh(box(0.75, 0.5, 1.25))
      .setTranslation([0, 0.65, 0]),
  );
  scene.addChild(
    doc
      .createNode('wheel-front-left')
      .setMesh(box(0.1, 0.3, 0.3))
      .setTranslation([0.6, 0.3, 0.8]),
  );
  scene.addChild(
    doc
      .createNode('wheel-back-left')
      .setMesh(box(0.1, 0.3, 0.3))
      .setTranslation([0.6, 0.3, -0.8]),
  );
  return doc;
}

describe('Fahrzeugmaße aus dem Modell', () => {
  it('Box ohne Räder, Radmitten und Radius', () => {
    const d = vehicleDims(car(), ['wheel-front-left', 'wheel-back-left']);
    expect(d.box).toEqual([1.5, 1, 2.5]);
    expect(d.center).toEqual([0, 0.65, 0]);
    expect(d.wheels[0]).toEqual({ name: 'wheel-front-left', x: 0.6, y: 0.3, z: 0.8, radius: 0.3 });
  });

  it('Maßstab je Achse wirkt auf Geometrie und Radlagen', () => {
    const doc = car();
    scaleScene(doc, [1.2, 1.1, 1.6]);
    const d = vehicleDims(doc, ['wheel-front-left', 'wheel-back-left']);
    expect(d.box[2]).toBeCloseTo(4);
    expect(d.wheels[0].z).toBeCloseTo(1.28);
    expect(d.wheels[0].radius).toBeCloseTo(0.33);
  });

  it('Radmitte aus der Geometrie, nicht aus dem Knotenursprung', () => {
    const doc = car();
    const wheel = doc
      .getRoot()
      .listNodes()
      .find((n) => n.getName() === 'wheel-front-left')!;
    const buffer = doc.getRoot().listBuffers()[0];
    // Geometrie seitlich versetzt: x von 0 bis 0,3 relativ zum Knoten
    wheel
      .getMesh()!
      .listPrimitives()[0]
      .setAttribute(
        'POSITION',
        doc
          .createAccessor()
          .setType('VEC3')
          .setArray(new Float32Array([0, -0.3, -0.3, 0.3, 0.3, 0.3, 0, 0.3, 0.3]))
          .setBuffer(buffer),
      );
    expect(vehicleDims(doc, ['wheel-front-left']).wheels[0].x).toBeCloseTo(0.75);
  });

  it('fehlender Radknoten ist ein Fehler', () => {
    expect(() => vehicleDims(car(), ['wheel-x'])).toThrow();
  });

  it('Sitzpunkt = Mitte der Oberkante des Sitzknotens', () => {
    const doc = car();
    const body = doc
      .getRoot()
      .listNodes()
      .find((n) => n.getName() === 'body')!;
    body.setName('seat');
    const d = vehicleDims(doc, ['wheel-front-left'], 'seat');
    expect(d.seat).toEqual([0, 1.15, 0]);
    expect(vehicleDims(car(), ['wheel-front-left']).seat).toBeUndefined();
    expect(() => vehicleDims(car(), ['wheel-front-left'], 'seat')).toThrow();
  });
});
