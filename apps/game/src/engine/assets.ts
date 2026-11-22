import { Tools } from '@babylonjs/core/Misc/tools';
// Vite bündelt die WASM-Datei als gehashtes Asset -> wird vom Service Worker vorgeladen.
import havokWasmUrl from '@babylonjs/havok/lib/esm/HavokPhysics.wasm?url';

/** Basis-URL der App (Vite `base`). */
export const BASE_URL = import.meta.env.BASE_URL;

/** Lokale Pfade aller WASM-Dateien. Nichts darf zur Laufzeit von einem CDN kommen (offline!). */
export const LOCAL_ASSETS = {
  havokWasm: havokWasmUrl,
} as const;

let configured = false;

/**
 * Biegt Babylon-Standardpfade, die sonst auf cdn.babylonjs.com zeigen, auf die eigene Herkunft um.
 * Wird ein Feature versehentlich genutzt, das CDN-Code nachlädt, schlägt es lokal fehl (404),
 * statt still eine Online-Abhängigkeit einzuführen.
 */
export function configureLocalAssets(): void {
  if (configured) return;
  configured = true;
  Tools.ScriptBaseUrl = `${BASE_URL}vendor/`;
  Tools.CDNBaseUrl = `${BASE_URL}vendor`;
}
