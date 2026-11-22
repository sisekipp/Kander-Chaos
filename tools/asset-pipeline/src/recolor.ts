import type { Document, Material, Primitive } from '@gltf-transform/core';

/** Farbzonen eines Rezepts: Zonenname -> Teilzeichenketten von Materialnamen (ohne Groß/klein). */
export type ColorZones = Record<string, string[]>;

/** Name des gemeinsamen Materials für feste Farben (in Vertex-Farben eingebacken). */
export const FIXED_MATERIAL = 'fixed';
export const zoneMaterialName = (zone: string) => `zone_${zone}`;

function zoneOf(material: Material | null, zones: ColorZones): string | null {
  const name = (material?.getName() ?? '').toLowerCase();
  for (const [zone, matchers] of Object.entries(zones))
    if (matchers.some((m) => name.includes(m.toLowerCase()))) return zone;
  return null;
}

/** Schreibt eine einheitliche Vertex-Farbe (RGBA) in COLOR_0 des Primitivs. */
function bakeColor(doc: Document, prim: Primitive, rgba: [number, number, number, number]): void {
  const pos = prim.getAttribute('POSITION');
  if (!pos) return;
  const n = pos.getCount();
  const arr = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) arr.set(rgba, i * 4);
  const buffer = doc.getRoot().listBuffers()[0] ?? doc.createBuffer();
  prim.setAttribute('COLOR_0', doc.createAccessor().setType('VEC4').setArray(arr).setBuffer(buffer));
}

/**
 * Vereinheitlicht die Materialien auf die Spielpalette:
 * - Materialien einer Farbzone (z. B. Lack, Kleidung) werden zu einem Material `zone_<name>` zusammengefasst,
 *   dessen Farbe das Spiel je Instanz setzt (deterministisch aus der ID).
 * - Alle übrigen Farben werden als Vertex-Farbe eingebacken und teilen sich das Material `fixed`.
 * Ergebnis: höchstens 1 + Anzahl Zonen Materialien je Modell.
 */
export function applyColorZones(doc: Document, zones: ColorZones): { zones: string[]; materials: number } {
  const root = doc.getRoot();
  const made = new Map<string, Material>();
  const material = (name: string, white: boolean) => {
    let m = made.get(name);
    if (!m) {
      m = doc.createMaterial(name).setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(1).setMetallicFactor(0);
      if (!white) m.setBaseColorFactor([0.8, 0.8, 0.8, 1]);
      made.set(name, m);
    }
    return m;
  };
  const used = new Set<string>();
  for (const mesh of root.listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const old = prim.getMaterial();
      const zone = zoneOf(old, zones);
      if (zone) {
        const m = material(zoneMaterialName(zone), true);
        // Grundton der Quelle als Vorgabe merken (wird im Spiel überschrieben)
        if (old) m.setBaseColorFactor(old.getBaseColorFactor());
        bakeColor(doc, prim, [1, 1, 1, 1]);
        prim.setMaterial(m);
        used.add(zone);
      } else {
        const c = old?.getBaseColorFactor() ?? [0.8, 0.8, 0.8, 1];
        bakeColor(doc, prim, [c[0], c[1], c[2], c[3]]);
        prim.setMaterial(material(FIXED_MATERIAL, true));
      }
    }
  for (const m of root.listMaterials()) if (![...made.values()].includes(m)) m.dispose();
  return { zones: [...used].sort(), materials: made.size };
}
