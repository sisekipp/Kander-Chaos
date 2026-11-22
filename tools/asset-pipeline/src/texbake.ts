import type { Accessor, Document, Material, Node, Primitive } from '@gltf-transform/core';
import { unweld } from '@gltf-transform/functions';
import { decodePng, sampleRgb, type RgbaImage } from './png.ts';
import { FIXED_MATERIAL, zoneMaterialName } from './recolor.ts';

type RGB = [number, number, number];

/** Farbtonabstand (0 … 1 Farbkreis), bis zu dem ein Dreieck noch zum Lack gehört (Helligkeitsstufen). */
const HUE_TOLERANCE = 0.05;
/** Mindestsättigung der Lackfarbe (Glas, Reifen, Chrom sind unbunt). */
const MIN_PAINT_SATURATION = 0.25;

const saturation = (c: RGB) => {
  const max = Math.max(...c),
    min = Math.min(...c);
  return max === 0 ? 0 : (max - min) / max;
};
const luminance = (c: RGB) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/** Farbton 0 … 1 (HSV). */
export function hue(c: RGB): number {
  const max = Math.max(...c),
    min = Math.min(...c),
    d = max - min;
  if (d === 0) return 0;
  let h = max === c[0] ? (c[1] - c[2]) / d : max === c[1] ? 2 + (c[2] - c[0]) / d : 4 + (c[0] - c[1]) / d;
  h /= 6;
  return h < 0 ? h + 1 : h;
}

/** Gehört die Farbe zum Lack (gleicher Farbton, bunt)? */
export function isPaintShade(c: RGB, paint: RGB): boolean {
  if (saturation(c) < MIN_PAINT_SATURATION) return false;
  const dh = Math.abs(hue(c) - hue(paint));
  return Math.min(dh, 1 - dh) <= HUE_TOLERANCE;
}

function triArea(p: Accessor, t: number): number {
  const a = p.getElement(t * 3, []),
    b = p.getElement(t * 3 + 1, []),
    c = p.getElement(t * 3 + 2, []);
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
    v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
}

/** Farbe je Dreieck aus der Textur (Mittelpunkt der UVs, nächster Texel). Erwartet nicht indizierte Primitive. */
export function triangleColors(prim: Primitive, img: RgbaImage): RGB[] {
  const uv = prim.getAttribute('TEXCOORD_0')!;
  const n = uv.getCount() / 3;
  const out: RGB[] = [];
  for (let t = 0; t < n; t++) {
    let u = 0,
      v = 0;
    for (let k = 0; k < 3; k++) {
      const e = uv.getElement(t * 3 + k, []);
      u += e[0] / 3;
      v += e[1] / 3;
    }
    out.push(sampleRgb(img, u, v));
  }
  return out;
}

/** Häufigste bunte Farbe nach Fläche = Lackfarbe (null, wenn keine bunte Farbe vorkommt). */
export function detectPaint(colors: RGB[], areas: number[]): RGB | null {
  const bins = new Map<string, { c: RGB; a: number }>();
  colors.forEach((c, i) => {
    if (saturation(c) < MIN_PAINT_SATURATION) return;
    const key = c.map((v) => Math.round(v * 255)).join(',');
    const b = bins.get(key) ?? { c, a: 0 };
    b.a += areas[i];
    bins.set(key, b);
  });
  let best: { c: RGB; a: number } | null = null;
  for (const b of bins.values()) if (!best || b.a > best.a) best = b;
  return best?.c ?? null;
}

/** Neues Primitiv aus einer Dreiecksauswahl (POSITION, NORMAL) mit Vertex-Farben. */
function subPrimitive(doc: Document, src: Primitive, tris: number[], colors: RGB[], material: Material): Primitive {
  const buffer = doc.getRoot().listBuffers()[0];
  const prim = doc.createPrimitive().setMaterial(material);
  for (const sem of ['POSITION', 'NORMAL']) {
    const a = src.getAttribute(sem);
    if (!a) continue;
    const size = a.getElementSize();
    const arr = new Float32Array(tris.length * 3 * size);
    tris.forEach((t, i) => {
      for (let k = 0; k < 3; k++) arr.set(a.getElement(t * 3 + k, []), (i * 3 + k) * size);
    });
    prim.setAttribute(sem, doc.createAccessor().setType(a.getType()).setArray(arr).setBuffer(buffer));
  }
  const col = new Float32Array(tris.length * 12);
  tris.forEach((t, i) => {
    for (let k = 0; k < 3; k++) col.set([...colors[t], 1], (i * 3 + k) * 4);
  });
  prim.setAttribute('COLOR_0', doc.createAccessor().setType('VEC4').setArray(col).setBuffer(buffer));
  return prim;
}

export interface TextureBakeOptions {
  /** Knoten, aus dessen Fläche die Lackfarbe ermittelt wird (z. B. „body“); null = keine Lack-Zone. */
  paintNode: string | null;
  /** Feste Lackfarbe statt automatischer Erkennung (0 … 1). */
  paint?: RGB;
}

/**
 * Ersetzt Paletten-Texturen durch Vertex-Farben (Werte wie in der Textur, das Spiel rechnet ohne Gammaumwandlung):
 * Dreiecke im Farbton des Lacks (alle Helligkeitsstufen) kommen in die Zone `zone_paint`; ihre Vertex-Farbe ist
 * der Grauwert der Stufe relativ zur hellsten, die Zonenfarbe setzt das Spiel je Fahrzeug. Alle übrigen behalten
 * ihre Farbe im Material `fixed`. Danach braucht das Modell keine Textur mehr.
 */
export async function bakePaletteTexture(doc: Document, opts: TextureBakeOptions): Promise<{ paint: RGB | null }> {
  await doc.transform(unweld());
  const root = doc.getRoot();
  const fixed = doc
    .createMaterial(FIXED_MATERIAL)
    .setBaseColorFactor([1, 1, 1, 1])
    .setRoughnessFactor(1)
    .setMetallicFactor(0);
  const zone = doc.createMaterial(zoneMaterialName('paint')).setRoughnessFactor(1).setMetallicFactor(0);
  const images = new Map<Material, RgbaImage>();
  const imageOf = (m: Material | null) => {
    const tex = m?.getBaseColorTexture();
    if (!m || !tex) return null;
    if (!images.has(m)) images.set(m, decodePng(tex.getImage()!));
    return images.get(m)!;
  };
  // Lackfarbe aus dem Lack-Knoten bestimmen
  let paint: RGB | null = opts.paint ?? null;
  const nodes = root.listNodes();
  if (!paint && opts.paintNode) {
    const node = nodes.find((n) => n.getName() === opts.paintNode);
    const colors: RGB[] = [],
      areas: number[] = [];
    for (const p of node?.getMesh()?.listPrimitives() ?? []) {
      const img = imageOf(p.getMaterial());
      if (!img) continue;
      const c = triangleColors(p, img);
      c.forEach((col, t) => {
        colors.push(col);
        areas.push(triArea(p.getAttribute('POSITION')!, t));
      });
    }
    paint = detectPaint(colors, areas);
  }
  // Hellste Stufe des Lacks wird Zonenfarbe; dunklere Stufen als Grauwert (Verhältnis der Helligkeit) erhalten
  let brightest: RGB | null = paint;
  if (paint) {
    const node = nodes.find((n) => n.getName() === opts.paintNode);
    for (const p of node?.getMesh()?.listPrimitives() ?? []) {
      const img = imageOf(p.getMaterial());
      if (!img) continue;
      for (const c of triangleColors(p, img))
        if (isPaintShade(c, paint) && luminance(c) > luminance(brightest!)) brightest = c;
    }
    zone.setBaseColorFactor([...brightest!, 1]);
  }
  const paintNodes = new Set<Node>(nodes.filter((n) => n.getName() === opts.paintNode));
  for (const node of nodes) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    for (const prim of mesh.listPrimitives()) {
      const img = imageOf(prim.getMaterial());
      const n = prim.getAttribute('POSITION')!.getCount() / 3;
      const colors: RGB[] = img ? triangleColors(prim, img) : Array.from({ length: n }, () => [0.8, 0.8, 0.8] as RGB);
      const paintTris: number[] = [],
        fixedTris: number[] = [];
      for (let t = 0; t < n; t++)
        (paint && paintNodes.has(node) && isPaintShade(colors[t], paint) ? paintTris : fixedTris).push(t);
      const shades: RGB[] = colors.map((c) => {
        const g = brightest ? Math.min(1, luminance(c) / Math.max(1e-6, luminance(brightest))) : 1;
        return [g, g, g];
      });
      if (fixedTris.length) mesh.addPrimitive(subPrimitive(doc, prim, fixedTris, colors, fixed));
      if (paintTris.length) mesh.addPrimitive(subPrimitive(doc, prim, paintTris, shades, zone));
      mesh.removePrimitive(prim);
      prim.dispose();
    }
  }
  for (const m of root.listMaterials()) if (m !== fixed && m !== zone) m.dispose();
  for (const t of root.listTextures()) t.dispose();
  if (!root.listMeshes().some((m) => m.listPrimitives().some((p) => p.getMaterial() === zone))) zone.dispose();
  return { paint };
}
