import { expect, test } from '@playwright/test';
import { firstVisit, waitPlayable } from './helpers.ts';
import { readFileSync, writeFileSync } from 'node:fs';

test('Position bleibt nach Schließen und erneutem Öffnen erhalten', async ({ page, context }) => {
  await firstVisit(page, '?debug&autosave=1000');
  await page.getByRole('button', { name: 'Testmodus' }).click();
  await waitPlayable(page);
  const target = await page.evaluate(() => {
    const w = (window as any).__kc.getWorld();
    const s = w.index.spawn;
    w.player.teleport(s.x + 60, s.z - 40);
    return { x: s.x + 60, z: s.z - 40 };
  });
  await waitPlayable(page);
  await page.waitForTimeout(2500); // Autosave (1 s im Test)
  await page.close();

  const page2 = await context.newPage();
  await page2.goto('/?debug');
  await page2.getByRole('button', { name: 'Testmodus' }).click();
  await waitPlayable(page2);
  const pos = await page2.evaluate(() => {
    const p = (window as any).__kc.getWorld().player.position;
    return { x: p.x, z: p.z };
  });
  expect(Math.abs(pos.x - target.x)).toBeLessThan(2);
  expect(Math.abs(pos.z - target.z)).toBeLessThan(2);
});

test('Spielstand exportieren und importieren; kaputte und fremde Dateien werden abgelehnt', async ({ page }, info) => {
  await firstVisit(page, '?debug&autosave=1000');
  await page.getByRole('button', { name: 'Testmodus' }).click();
  await waitPlayable(page);
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: 'Menü' }).click();

  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Spielstand exportieren' }).click();
  const file = info.outputPath('stand.json');
  await (await dl).saveAs(file);
  const saved = JSON.parse(readFileSync(file, 'utf8'));
  expect(saved.kind).toBe('kandern-chaos-spielstand');

  // Spielstand löschen (wie wenn Safari die Daten entfernt hätte), Datei wieder importieren
  const idb = (op: 'delete' | 'get') =>
    page.evaluate(async (o) => {
      const db: IDBDatabase = await new Promise((r) => {
        const q = indexedDB.open('keyval-store');
        q.onsuccess = () => r(q.result);
      });
      const store = db.transaction('keyval', o === 'delete' ? 'readwrite' : 'readonly').objectStore('keyval');
      const res = await new Promise((r) => {
        const t = o === 'delete' ? store.delete('kc.save.slot1') : store.get('kc.save.slot1');
        t.onsuccess = () => r(t.result ?? null);
      });
      db.close();
      return res as any;
    }, op);
  await idb('delete');
  expect(await idb('get')).toBeNull();
  await page.getByTestId('import-input').setInputFiles(file);
  await expect(page.getByText(/Spielstand vom .* geladen/)).toBeVisible();

  const broken = info.outputPath('kaputt.json');
  writeFileSync(broken, '{"kind": "kandern-chaos-spiel');
  await page.getByTestId('import-input').setInputFiles(broken);
  await expect(page.getByText(/beschädigt oder kein Spielstand/)).toBeVisible();

  const foreign = info.outputPath('fremd.json');
  writeFileSync(foreign, JSON.stringify({ hello: 'world' }));
  await page.getByTestId('import-input').setInputFiles(foreign);
  await expect(page.getByText(/kein Kandern-Chaos-Spielstand/)).toBeVisible();

  // Bestehender Stand ist unverändert geblieben
  const kept = await idb('get');
  expect(kept.player.x).toBeCloseTo(saved.player.x, 1);
});
