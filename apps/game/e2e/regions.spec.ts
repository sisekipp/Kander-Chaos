import { expect, test, type Page } from '@playwright/test';
import { firstVisit, waitPlayable } from './helpers.ts';

test.setTimeout(300_000);

/** Kern-Kachel, deren östliche Nachbarkachel in einer Nachladeregion liegt (Weltkoordinaten der Mitte). */
const edgeTile = (page: Page) =>
  page.evaluate(() => {
    const w = (window as any).__kc.getWorld();
    const idx = w.index;
    const s = idx.tileSize;
    for (const [id, loc] of Object.entries(idx.tiles) as [string, number[]][]) {
      const [tx, tz] = id.split(',').map(Number);
      const east = idx.tiles[`${tx + 1},${tz}`];
      if (!idx.packs[loc[0]].remote && east && idx.packs[east[0]].remote)
        return { x: (tx + 0.5) * s, z: (tz + 0.5) * s, edgeX: (tx + 1) * s };
    }
    return null;
  });

test('Erstbesuch lädt nur den Kern, keine Nachladeregionen', async ({ page }) => {
  const remote: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/world-remote/')) remote.push(r.url());
  });
  await firstVisit(page);
  expect(remote).toHaveLength(0);
  const cached = await page.evaluate(async () => {
    const keys = await (await caches.open('kc-world')).keys();
    return keys.filter((k) => k.url.includes('world-remote')).length;
  });
  expect(cached).toBe(0);
  await expect(page.getByTestId('region-storage')).toContainText('Gespeicherte Regionen: 0');
});

test('ohne Netz: weicher Rand vor der Nachladeregion, Hinweis erscheint, keine Löcher', async ({ page }) => {
  await firstVisit(page);
  // nach dem Laden wirklich offline gehen (Kern liegt im Cache, Nachladeregionen nicht)
  await page.context().setOffline(true);
  await page.getByRole('button', { name: 'Testmodus' }).click();
  await waitPlayable(page);
  const edge = await edgeTile(page);
  expect(edge).not.toBeNull();
  // im Flugmodus von der Kern-Kachel aus nach Osten auf die gesperrte Region zufliegen
  await page.evaluate(({ x, z }) => (window as any).__kc.getWorld().player.teleport(x - 80, z), edge!);
  await page.waitForFunction(() => (window as any).__kc.getWorld().tiles.isSettled, null, { timeout: 90_000 });
  await page.evaluate(() => (window as any).__kc.getWorld().startFlying());
  const r = await page.evaluate(async (edgeX) => {
    const kc = (window as any).__kc;
    const w = kc.getWorld();
    kc.getGame().camera.alpha = Math.PI; // Blick nach +x
    kc.input.moveY = 1;
    let maxX = -Infinity,
      holes = 0,
      hint = false;
    for (let k = 0; k < 160; k++) {
      await new Promise((res) => setTimeout(res, 150));
      const p = w.fly?.controllerState?.position ?? w.player.position;
      maxX = Math.max(maxX, p.x);
      if (!w.tiles.tileAt(p.x, p.z)) holes++;
      hint ||= kc.store.getState().regionEdge && !!document.querySelector('.region-hint');
    }
    kc.input.moveY = 0;
    const pz = (w.fly?.controllerState?.position ?? w.player.position).z;
    return {
      maxX,
      holes,
      edgeX,
      hint,
      blocked: w.tiles.isBlocked(edgeX + 50, pz),
      edge: kc.store.getState().regionEdge,
      border: !!w.border,
      st: w.tiles.o.packs.state(w.index.tiles[`${Math.floor((edgeX + 50) / 250)},${Math.floor(pz / 250)}`][0]),
      east: w.tiles.tileAt(edgeX + 50, pz)?.ring ?? null,
    };
  }, edge!.edgeX);
  console.log(JSON.stringify(r));
  expect(r.hint).toBe(true);
  expect(r.maxX).toBeLessThan(r.edgeX);
  expect(r.holes).toBe(0);
});

test('Gespeicherte Regionen löschen behält den Spielstand', async ({ page }) => {
  await firstVisit(page);
  // eine Region und einen Spielstand anlegen
  await page.evaluate(async () => {
    const idx = await fetch('/world/index.json').then((r) => r.json());
    const p = idx.packs.find((x: any) => x.remote);
    const c = await caches.open(`kc-regions-${idx.buildVersion}`);
    await c.put(p.file, new Response(new Uint8Array(1024)));
    localStorage.setItem(
      'kc-regions-meta',
      JSON.stringify({ version: idx.buildVersion, entries: [{ file: p.file, bytes: 1024, lastVisit: 1 }] }),
    );
    const req = indexedDB.open('keyval-store');
    await new Promise((res) => {
      req.onupgradeneeded = () => req.result.createObjectStore('keyval');
      req.onsuccess = res;
    });
    const tx = req.result.transaction('keyval', 'readwrite');
    tx.objectStore('keyval').put({ test: true }, 'kc.save.slot1');
    await new Promise((res) => (tx.oncomplete = res));
  });
  await page.reload();
  const go = page.getByRole('button', { name: 'Los geht’s' });
  const menu = page.getByRole('button', { name: 'Testmodus' });
  await go.or(menu).first().waitFor({ timeout: 90_000 });
  if (await go.isVisible()) await go.click();
  await menu.waitFor();
  await expect(page.getByTestId('region-storage')).toContainText('Gespeicherte Regionen: 1');
  await page.getByRole('button', { name: 'Gespeicherte Regionen löschen' }).click();
  await expect(page.getByTestId('region-storage')).toContainText('Gespeicherte Regionen: 0');
  const left = await page.evaluate(async () => {
    const regions = (await caches.keys()).filter((k) => k.startsWith('kc-regions-')).length;
    const req = indexedDB.open('keyval-store');
    await new Promise((res) => (req.onsuccess = res));
    const get = req.result.transaction('keyval').objectStore('keyval').get('kc.save.slot1');
    const save = await new Promise((res) => (get.onsuccess = () => res(get.result)));
    return { regions, save };
  });
  expect(left.regions).toBe(0);
  expect(left.save).toEqual({ test: true });
});
