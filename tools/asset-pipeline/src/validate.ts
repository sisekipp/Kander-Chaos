import { ImageUtils, type Document } from '@gltf-transform/core';
import type { ModelKind } from './registry.ts';

/** Dreiecksgrenzen je Art (Design: Figur 3.000, Auto ≤ 2.500, Prop ≤ 600, Wahrzeichen ≤ 8.000). */
export const TRIANGLE_LIMITS: Record<ModelKind, number> = {
  figure: 3000,
  npc: 3000,
  vehicle: 2500,
  prop: 600,
  landmark: 8000,
};
/** Hubschrauber: Hauptfahrzeug für die große Karte, oft nah im Bild (Design world-expansion-helicopter D7). */
export const HELICOPTER_TRIANGLES = 6000;
/** Große Wahrzeichen der Region (Hochhäuser, Terminal, Bahnhofshallen; Change landmarks-region D3). */
export const LANDMARK_LARGE_TRIANGLES = 15000;

/** Dreiecksgrenze eines Rezepts. */
export function triangleLimitFor(r: { kind: ModelKind; large?: boolean; vehicle?: { vehicleKind?: number } }): number {
  if (r.vehicle?.vehicleKind === 3) return HELICOPTER_TRIANGLES;
  if (r.kind === 'landmark' && r.large) return LANDMARK_LARGE_TRIANGLES;
  return TRIANGLE_LIMITS[r.kind];
}
/** Höchstzahl der Materialien je Art (Wahrzeichen ≤ 2, sonst feste Farben + Farbzonen). */
export const MATERIAL_LIMITS: Record<ModelKind, number> = { figure: 4, npc: 4, vehicle: 4, prop: 3, landmark: 2 };
export const MAX_TEXTURE_SIZE = 512;
export const MIN_DETACHABLE_PARTS = 2;
/** Budget aller Modelle im Build (Bytes). */
export const MODELS_BUDGET = 15 * 1024 * 1024;

/** Gezeichnete Dreiecke: je Knoten mit Mesh (gemeinsam genutzte Meshes, z. B. Räder, zählen mehrfach). */
export function countTriangles(doc: Document): number {
  let n = 0;
  for (const node of doc.getRoot().listNodes())
    for (const p of node.getMesh()?.listPrimitives() ?? []) {
      if (p.getMode() !== 4) continue; // nur TRIANGLES
      n += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION')?.getCount() ?? 0) / 3;
    }
  return Math.round(n);
}

/** Knoten mit `detach_` im Namen (lösbare Teile für den Schaden, Spec vehicle-damage). */
export function detachableParts(doc: Document): string[] {
  return doc
    .getRoot()
    .listNodes()
    .map((n) => n.getName())
    .filter((name) => name.toLowerCase().includes('detach_'));
}

/** Prüft ein optimiertes Modell gegen die Regeln seiner Art; liefert Fehlermeldungen (leer = gültig). */
export function validateModel(
  id: string,
  kind: ModelKind,
  doc: Document,
  triangleLimit = TRIANGLE_LIMITS[kind],
): string[] {
  const errors: string[] = [];
  const tris = countTriangles(doc);
  if (tris > triangleLimit) errors.push(`${id}: ${tris} Dreiecke > ${triangleLimit} (${kind})`);
  const mats = doc.getRoot().listMaterials().length;
  if (mats > MATERIAL_LIMITS[kind]) errors.push(`${id}: ${mats} Materialien > ${MATERIAL_LIMITS[kind]} (${kind})`);
  for (const t of doc.getRoot().listTextures()) {
    const img = t.getImage();
    const size = img ? ImageUtils.getSize(img, t.getMimeType()) : null;
    if (size && (size[0] > MAX_TEXTURE_SIZE || size[1] > MAX_TEXTURE_SIZE))
      errors.push(`${id}: Textur ${size[0]}×${size[1]} > ${MAX_TEXTURE_SIZE} px`);
  }
  if (kind === 'vehicle') {
    const parts = detachableParts(doc).length;
    if (parts < MIN_DETACHABLE_PARTS)
      errors.push(`${id}: nur ${parts} lösbare Teile (detach_*), mindestens ${MIN_DETACHABLE_PARTS}`);
  }
  return errors;
}

/** Gesamtgröße aller Modelle gegen das Budget (Spec: Build schlägt über 15 MB fehl). */
export function checkBudget(sizes: Record<string, number>): { total: number; ok: boolean; message: string } {
  const total = Object.values(sizes).reduce((a, b) => a + b, 0);
  const mb = (total / 1048576).toFixed(2);
  const ok = total <= MODELS_BUDGET;
  return { total, ok, message: ok ? `Modelle ${mb} MB ≤ 15 MB` : `Modelle ${mb} MB > 15 MB (Budget überschritten)` };
}
