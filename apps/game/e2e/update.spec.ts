import { expect, test } from '@playwright/test';
import { copyFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { firstVisit, waitPlayable } from './helpers.ts';

const WORLD = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist/world');

/**
 * Simuliert eine neue Datenversion auf dem Server: ein Paket bekommt einen neuen Namen, der Rest bleibt.
 * Erwartet: nur dieses eine Paket wird nachgeladen, "Update bereit" erscheint ohne das Spiel zu stoppen,
 * aktiviert wird erst nach Bestätigung; danach ist das alte Paket aus dem Cache entfernt.
 */
test('neue Weltversion: nur geänderte Pakete, Hinweis ohne Unterbrechung, Aktivierung nach Bestätigung', async ({
  page,
}) => {
  const indexFile = path.join(WORLD, 'index.json');
  const original = readFileSync(indexFile, 'utf8');
  const idx = JSON.parse(original);
  // ein Kernpaket ändern (nur Kernpakete liegen im Welt-Cache)
  const core = idx.packs.findIndex((p: { remote?: boolean }) => !p.remote);
  const coreCount = idx.packs.filter((p: { remote?: boolean }) => !p.remote).length;
  const oldFile: string = idx.packs[core].file;
  const newFile = oldFile.replace(/\.bin$/, '.neu.bin');
  try {
    await firstVisit(page);
    const cachedBefore = await page.evaluate(async () => (await (await caches.open('kc-world')).keys()).length);

    copyFileSync(path.join(WORLD, oldFile), path.join(WORLD, newFile));
    idx.packs[core].file = newFile;
    idx.buildVersion = 'update-test';
    writeFileSync(indexFile, JSON.stringify(idx));

    await page.reload();
    await page.getByRole('button', { name: 'Testmodus' }).click();
    await waitPlayable(page);
    await expect(page.getByText('Update bereit')).toBeVisible({ timeout: 60_000 });
    // Genau ein neues Paket (+ vorgemerkter Index/Metadaten unter world/pending/)
    const cache = await page.evaluate(async () =>
      (await (await caches.open('kc-world')).keys()).map((k) => new URL(k.url).pathname),
    );
    expect(cache.filter((k) => /\/region_[^/]*\.bin$/.test(k)).length).toBe(coreCount + 1);
    expect(cache).toContain(`/world/${newFile}`);
    // Spiel läuft weiter; aktiv ist noch die alte Version
    await waitPlayable(page);
    expect(await page.evaluate(async () => (await (await fetch('/world/index.json')).json()).buildVersion)).not.toBe(
      'update-test',
    );
    expect(cachedBefore).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Jetzt aktualisieren' }).click();
    await page.waitForLoadState('load');
    await expect
      .poll(async () => page.evaluate(async () => (await (await fetch('/world/index.json')).json()).buildVersion))
      .toBe('update-test');
    const after = await page.evaluate(async () =>
      (await (await caches.open('kc-world')).keys()).map((k) => new URL(k.url).pathname),
    );
    expect(after).not.toContain(`/world/${oldFile}`);
  } finally {
    writeFileSync(indexFile, original);
    rmSync(path.join(WORLD, newFile), { force: true });
  }
});
