import type { Document } from '@gltf-transform/core';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createIO, optimizeDocument } from './optimize.ts';
import { paths } from './paths.ts';
import { applyColorZones } from './recolor.ts';
import { parseRecipe, type ManifestEntry, type Recipe } from './recipe.ts';
import { createHash } from 'node:crypto';
import { checkBudget, countTriangles, detachableParts, triangleLimitFor, validateModel } from './validate.ts';
import { splitParts } from './split.ts';
import { bakePaletteTexture } from './texbake.ts';
import { scaleScene, vehicleDims } from './vehicleDims.ts';
import { joinPrimitives, prune } from '@gltf-transform/functions';
import { bakeVat, toHalf, type VatClip } from './bakeVat.ts';

export async function loadRecipes(): Promise<Recipe[]> {
  if (!existsSync(paths.recipes)) return [];
  const files = (await readdir(paths.recipes)).filter((f) => f.endsWith('.json')).sort();
  // Eine Datei enthält ein Rezept oder eine Liste (z. B. die erzeugten Wahrzeichen-Rezepte)
  const lists = await Promise.all(
    files.map(async (f) => {
      const json: unknown = JSON.parse(await readFile(path.join(paths.recipes, f), 'utf8'));
      return (Array.isArray(json) ? json : [json]).map((r) => parseRecipe(r, f));
    }),
  );
  return lists.flat();
}

function sourcePath(r: Recipe): string {
  const inSources = path.join(paths.sources, r.source);
  return existsSync(inSources) ? inSources : path.join(paths.assets, r.source);
}

/**
 * Baut alle Rezepte: Quelle lesen, skalieren, Farbzonen anwenden, optimieren, prüfen, schreiben.
 * Bricht bei Regelverstößen oder Budgetüberschreitung mit Fehlermeldungen ab.
 */
export async function buildModels(): Promise<{ ok: boolean; messages: string[] }> {
  const recipes = await loadRecipes();
  const io = await createIO();
  const manifest: ManifestEntry[] = [];
  const remote: ManifestEntry[] = [];
  const messages: string[] = [];
  const sizes: Record<string, number> = {};
  await mkdir(paths.out, { recursive: true });
  await mkdir(paths.outRemote, { recursive: true });
  for (const f of await readdir(paths.outRemote)) if (f.endsWith('.glb')) await rm(path.join(paths.outRemote, f));
  for (const r of recipes) {
    const doc = await io.read(sourcePath(r));
    let zones: string[] = [];
    if (r.texture) {
      const { paint } = await bakePaletteTexture(doc, r.texture);
      if (paint) zones = ['paint'];
    }
    if (r.parts?.length) {
      const cut = splitParts(doc, r.parts);
      for (const [name, n] of Object.entries(cut)) if (!n) messages.push(`✘ ${r.id}: Teil ${name} ohne Dreiecke`);
    }
    if (!r.texture) zones = applyColorZones(doc, r.colorZones ?? {}).zones;
    if (r.scale !== undefined && r.scale !== 1)
      scaleScene(doc, typeof r.scale === 'number' ? [r.scale, r.scale, r.scale] : r.scale);
    const dims = r.vehicle ? vehicleDims(doc, r.vehicle.wheels, r.vehicle.seat) : null;
    if (r.kind === 'npc') mergeSkinnedPrimitives(doc); // ein Primitiv = ein Draw Call
    await optimizeDocument(doc);
    // Nach der Optimierung backen: die Quantisierung verrechnet ihre Skalierung in die inversen Bindematrizen
    const vat = r.kind === 'npc' ? await bakeNpc(doc, r.id) : null;
    const errors = validateModel(r.id, r.kind, doc, triangleLimitFor(r));
    if (errors.length) {
      messages.push(...errors.map((e) => `✘ ${e}`));
      continue;
    }
    const glb = await io.writeBinary(doc);
    const sha256 = createHash('sha256').update(glb).digest('hex');
    // Regionsmodelle: unveränderliche Dateinamen mit Hash, eigenes Manifest, nicht im Offline-Budget
    const file = r.remote ? `${r.id}.${sha256.slice(0, 10)}.glb` : `${r.id}.glb`;
    await writeFile(path.join(r.remote ? paths.outRemote : paths.out, file), glb);
    if (vat) await writeFile(path.join(paths.out, vat.entry.file), vat.bytes);
    if (!r.remote) sizes[r.id] = glb.byteLength + (vat?.bytes.byteLength ?? 0);
    (r.remote ? remote : manifest).push({
      id: r.id,
      kind: r.kind,
      file,
      bytes: glb.byteLength,
      triangles: countTriangles(doc),
      zones,
      parts: detachableParts(doc),
      ...(r.vehicle && dims ? { vehicle: { ...withoutSeatName(r.vehicle), ...dims } } : {}),
      ...(r.remote ? { sha256 } : {}),
      ...(vat ? { vat: vat.entry } : {}),
    });
    messages.push(`✔ ${r.id}: ${countTriangles(doc)} Dreiecke, ${(glb.byteLength / 1024).toFixed(0)} KB`);
  }
  const budget = checkBudget(sizes);
  messages.push(`${budget.ok ? '✔' : '✘'} ${budget.message}`);
  const ok = budget.ok && !messages.some((m) => m.startsWith('✘'));
  if (ok) {
    await writeFile(
      path.join(paths.out, 'manifest.json'),
      JSON.stringify({ version: 1, models: manifest }, null, 2) + '\n',
    );
    await writeFile(
      path.join(paths.outRemote, 'manifest-remote.json'),
      JSON.stringify({ version: 1, models: remote }, null, 2) + '\n',
    );
  }
  return { ok, messages };
}

/**
 * Primitive mit gleichem Material je Mesh zu einem verbinden. `join()` von gltf-transform überspringt Meshes mit
 * Skelett; die Gelenke/Gewichte bleiben hier pro Vertex erhalten, deshalb ist das Verbinden sicher.
 */
export function mergeSkinnedPrimitives(doc: Document): void {
  for (const mesh of doc.getRoot().listMeshes()) {
    const byMat = new Map<unknown, ReturnType<typeof mesh.listPrimitives>>();
    for (const p of mesh.listPrimitives()) byMat.set(p.getMaterial(), [...(byMat.get(p.getMaterial()) ?? []), p]);
    for (const prims of byMat.values()) {
      if (prims.length < 2) continue;
      const joined = joinPrimitives(prims);
      for (const p of prims) {
        mesh.removePrimitive(p);
        p.dispose();
      }
      mesh.addPrimitive(joined);
    }
  }
}

/**
 * NPC-Figur: Animationen in eine VAT backen (Halbfloat) und aus dem Modell entfernen; das Skelett (Gelenke,
 * Gewichte) bleibt für den Shader.
 */
async function bakeNpc(doc: Document, id: string) {
  const v = bakeVat(doc, 30);
  for (const a of doc.getRoot().listAnimations()) a.dispose();
  await doc.transform(prune());
  const half = toHalf(v.data);
  const entry: VatInfo = { file: `${id}.vat.bin`, width: v.width, height: v.height, fps: v.fps, clips: v.clips };
  return { entry, bytes: new Uint8Array(half.buffer) };
}

/** Animationstextur einer NPC-Figur (RGBA16F, Breite · Höhe Texel). */
export interface VatInfo {
  file: string;
  width: number;
  height: number;
  fps: number;
  clips: Record<string, VatClip>;
}

/** Fahrzeugangaben fürs Manifest: der Sitzknoten-Name wird durch den berechneten Sitzpunkt ersetzt. */
function withoutSeatName<T extends { seat?: string }>(v: T): Omit<T, 'seat' | 'wheels'> {
  const { seat: _seat, wheels: _wheels, ...rest } = v as T & { wheels?: unknown };
  return rest;
}
