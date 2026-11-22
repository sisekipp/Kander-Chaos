/** Schalter für Render-Einstellungen, die beim Erzeugen der Engine feststehen müssen (Vergleichsmessungen). */

export const UBO_STORAGE_KEY = 'kc.uniformBuffers';

/**
 * Uniform-Buffer an (true) oder aus (false). Reihenfolge: URL-Parameter `ubo=0|1`, dann gespeicherte
 * Einstellung, sonst an. Auf manchen alten iOS-Geräten sind einzelne Uniforms schneller.
 */
export function uniformBuffersEnabled(search: string, stored: string | null): boolean {
  const p = new URLSearchParams(search).get('ubo');
  if (p === '0' || p === 'off') return false;
  if (p === '1' || p === 'on') return true;
  return stored !== '0';
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadUniformBuffersEnabled(): boolean {
  const search = typeof location === 'undefined' ? '' : location.search;
  return uniformBuffersEnabled(search, storage()?.getItem(UBO_STORAGE_KEY) ?? null);
}

/** Speichert die Einstellung; wirksam nach dem nächsten Neuladen der Seite. */
export function saveUniformBuffersEnabled(on: boolean): void {
  storage()?.setItem(UBO_STORAGE_KEY, on ? '1' : '0');
}
