import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, quantize, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

/** NodeIO mit allen Erweiterungen und meshopt-En-/Decoder (für Lesen und Schreiben). */
export async function createIO(): Promise<NodeIO> {
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  });
}

/**
 * Optimiert ein Modell für das Spiel: doppelte Daten zusammenfassen, Vertices verschweißen, Unbenutztes
 * entfernen, Geometrie quantisieren (KHR_mesh_quantization) und meshopt-komprimieren (EXT_meshopt_compression).
 */
export async function optimizeDocument(doc: Document): Promise<void> {
  await MeshoptEncoder.ready;
  await doc.transform(dedup(), weld(), prune(), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
}

/** Liest eine GLB/glTF-Datei, optimiert sie und liefert die GLB-Bytes. */
export async function optimizeFile(input: string, edit?: (doc: Document) => void | Promise<void>): Promise<Uint8Array> {
  const io = await createIO();
  const doc = await io.read(input);
  if (edit) await edit(doc);
  await optimizeDocument(doc);
  return io.writeBinary(doc);
}
