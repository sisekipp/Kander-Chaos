import type { Document, Node } from '@gltf-transform/core';

export interface WheelDims {
  name: string;
  x: number;
  y: number;
  z: number;
  radius: number;
}

export interface VehicleDims {
  /** Breite, Höhe, Länge der Karosserie (ohne Räder) in m. */
  box: [number, number, number];
  /** Mitte der Karosserie. */
  center: [number, number, number];
  wheels: WheelDims[];
}

function nodeBox(n: Node): { min: number[]; max: number[] } | null {
  const mesh = n.getMesh();
  if (!mesh) return null;
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  const s = n.getScale(),
    t = n.getTranslation();
  for (const p of mesh.listPrimitives()) {
    const a = p.getAttribute('POSITION')!;
    const lo = a.getMin([]),
      hi = a.getMax([]);
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], lo[k] * s[k] + t[k]);
      max[k] = Math.max(max[k], hi[k] * s[k] + t[k]);
    }
  }
  return { min, max };
}

/**
 * Maße eines Fahrzeugs aus dem (skalierten) Modell: Box der Karosserie aus allen Knoten außer den Rädern,
 * Radmitten aus der Mitte der Rad-Geometrie und Radradius aus der halben Höhe des Rad-Meshes. Werte in glTF-Koordinaten.
 */
export function vehicleDims(doc: Document, wheelNames: string[]): VehicleDims {
  const nodes = doc.getRoot().listNodes();
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (const n of nodes) {
    if (wheelNames.includes(n.getName())) continue;
    const b = nodeBox(n);
    if (!b) continue;
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], b.min[k]);
      max[k] = Math.max(max[k], b.max[k]);
    }
  }
  const wheels = wheelNames.map((name) => {
    const n = nodes.find((x) => x.getName() === name);
    if (!n) throw new Error(`Radknoten "${name}" fehlt`);
    // Mitte der Rad-Geometrie (der Knotenursprung liegt bei manchen Paketen an der Felgeninnenseite)
    const b = nodeBox(n)!;
    const [x, y, z] = [0, 1, 2].map((k) => (b.min[k] + b.max[k]) / 2);
    return { name, x, y, z, radius: (b.max[1] - b.min[1]) / 2 };
  });
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  return {
    box: [r3(max[0] - min[0]), r3(max[1] - min[1]), r3(max[2] - min[2])],
    center: [r3((min[0] + max[0]) / 2), r3((min[1] + max[1]) / 2), r3((min[2] + max[2]) / 2)],
    wheels: wheels.map((w) => ({ name: w.name, x: r3(w.x), y: r3(w.y), z: r3(w.z), radius: r3(w.radius) })),
  };
}

/** Skaliert alle Wurzelknoten je Achse (Lage und Größe), damit Radmitten und Geometrie zusammen wachsen. */
export function scaleScene(doc: Document, s: [number, number, number]): void {
  for (const scene of doc.getRoot().listScenes())
    for (const n of scene.listChildren()) {
      const t = n.getTranslation(),
        sc = n.getScale();
      n.setTranslation([t[0] * s[0], t[1] * s[1], t[2] * s[2]]);
      n.setScale([sc[0] * s[0], sc[1] * s[1], sc[2] * s[2]]);
    }
}
