import { MeshoptCompression } from '@babylonjs/core/Meshes/Compression/meshoptCompression';
import { MeshoptDecoder } from 'meshoptimizer';
import { BASE_URL } from '../engine/assets.ts';

let configured = false;

/**
 * Lokaler meshopt-Decoder (offline): Babylon erwartet ein globales `MeshoptDecoder`, das sonst ein
 * Skript vom CDN liefert. Wir setzen es aus dem gebündelten `meshoptimizer`-Paket und zeigen die
 * Skript-URL auf einen lokalen Platzhalter.
 */
export function configureMeshopt(): void {
  if (configured) return;
  configured = true;
  (globalThis as unknown as { MeshoptDecoder: typeof MeshoptDecoder }).MeshoptDecoder = MeshoptDecoder;
  MeshoptCompression.Configuration = { decoder: { url: `${BASE_URL}vendor/meshopt-shim.js` } };
}
