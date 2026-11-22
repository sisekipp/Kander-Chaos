import type { Document } from '@gltf-transform/core';

/** Lösbares Teil: Dreiecke des Quellknotens, deren Mittelpunkt in der Box (Knotenkoordinaten) liegt. */
export interface PartCut {
  /** Name des neuen Knotens, muss `detach_` enthalten (Spec vehicle-damage). */
  name: string;
  from: string;
  min: [number, number, number];
  max: [number, number, number];
}

/**
 * Trennt Bereiche eines Meshes in eigene Knoten ab (z. B. Stoßstangen, Türen), damit sie bei Schaden
 * abfallen können. Erwartet nicht indizierte Primitive (nach `bakePaletteTexture` bzw. `unweld`).
 * Liefert je Teil die Zahl der abgetrennten Dreiecke.
 */
export function splitParts(doc: Document, cuts: PartCut[]): Record<string, number> {
  const root = doc.getRoot();
  const buffer = root.listBuffers()[0];
  const result: Record<string, number> = {};
  for (const cut of cuts) {
    const src = root.listNodes().find((n) => n.getName() === cut.from);
    const mesh = src?.getMesh();
    if (!src || !mesh) throw new Error(`Teil ${cut.name}: Knoten "${cut.from}" ohne Mesh`);
    const partMesh = doc.createMesh(cut.name);
    let moved = 0;
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION')!;
      const n = pos.getCount() / 3;
      const inside: number[] = [],
        outside: number[] = [];
      for (let t = 0; t < n; t++) {
        const c = [0, 0, 0];
        for (let k = 0; k < 3; k++) pos.getElement(t * 3 + k, []).forEach((v, i) => (c[i] += v / 3));
        const hit = c.every((v, i) => v >= cut.min[i] && v <= cut.max[i]);
        (hit ? inside : outside).push(t);
      }
      if (!inside.length) continue;
      moved += inside.length;
      const take = (tris: number[]) => {
        const p = doc.createPrimitive().setMaterial(prim.getMaterial());
        for (const sem of prim.listSemantics()) {
          const a = prim.getAttribute(sem)!;
          const size = a.getElementSize();
          const arr = new Float32Array(tris.length * 3 * size);
          tris.forEach((t, i) => {
            for (let k = 0; k < 3; k++) arr.set(a.getElement(t * 3 + k, []), (i * 3 + k) * size);
          });
          p.setAttribute(sem, doc.createAccessor().setType(a.getType()).setArray(arr).setBuffer(buffer));
        }
        return p;
      };
      partMesh.addPrimitive(take(inside));
      if (outside.length) mesh.addPrimitive(take(outside));
      mesh.removePrimitive(prim);
      prim.dispose();
    }
    result[cut.name] = moved;
    if (!moved) {
      partMesh.dispose();
      continue;
    }
    const node = doc
      .createNode(cut.name)
      .setMesh(partMesh)
      .setTranslation(src.getTranslation())
      .setRotation(src.getRotation())
      .setScale(src.getScale());
    const parent = src.getParentNode();
    if (parent) parent.addChild(node);
    else for (const scene of root.listScenes()) if (scene.listChildren().includes(src)) scene.addChild(node);
  }
  return result;
}
