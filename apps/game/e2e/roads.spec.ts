import { expect, test, type Page } from '@playwright/test';
import { firstVisit, waitPlayable } from './helpers.ts';

test.setTimeout(300_000);

async function start(page: Page) {
  await firstVisit(page);
  await page.getByRole('button', { name: 'Testmodus' }).click();
  await waitPlayable(page);
}

async function place(page: Page, dx: number, dz: number) {
  await page.evaluate(
    ({ dx, dz }) => {
      const w = (window as any).__kc.getWorld();
      w.player.teleport(w.index.spawn.x + dx, w.index.spawn.z + dz);
    },
    { dx, dz },
  );
  await page.waitForFunction(
    () => {
      const w = (window as any).__kc.getWorld();
      return w.tiles.isSettled && !w.player.isFrozen;
    },
    null,
    { timeout: 90_000, polling: 300 },
  );
}

test('Straßenelemente der Blumenplatz-Kachel: höchstens 4 Draw Calls', async ({ page }) => {
  await start(page);
  await place(page, 0, 0);
  const r = await page.evaluate(() => {
    const kc = (window as any).__kc;
    const w = kc.getWorld();
    const id = `${Math.floor(w.index.spawn.x / 250)},${Math.floor(w.index.spawn.z / 250)}`;
    const g = kc.getGame();
    // Sichtbare Straßen-Meshes der Kachel (Straßen, Gehwege, Kreuzungen, Brücken) samt Teil-Meshes
    const mine = g.scene.meshes.filter((m: any) => m.name === `roads-${id}` && m.isVisible);
    const drawCalls = mine.reduce((n: number, m: any) => n + (m.subMeshes?.length ?? 1), 0);
    const all = g.scene.meshes.filter((m: any) => m.name.startsWith('roads-')).map((m: any) => m.name);
    return { id, drawCalls, unique: all.length === new Set(all).size, tiles: all.length };
  });
  console.log(JSON.stringify(r));
  expect(r.drawCalls).toBeGreaterThan(0);
  expect(r.drawCalls).toBeLessThanOrEqual(4);
  expect(r.unique).toBe(true);
});

test('Auto fährt über die Brücke „An der Schwemme“ ohne durchzufallen', async ({ page }) => {
  await start(page);
  // Brücke über die Kander: A(-108.8, -168.1) -> B(-110.2, -182.0), Deck ≈ 344,4–344,9 m
  const ax = -108.8,
    az = -168.1,
    bx = -110.2,
    bz = -182.0;
  const len = Math.hypot(bx - ax, bz - az);
  const ux = (bx - ax) / len,
    uz = (bz - az) / len;
  await place(page, ax - ux * 30, az - uz * 30);
  const r = await page.evaluate(
    async ({ ax, az, ux, uz }) => {
      const w = (window as any).__kc.getWorld();
      const sx = w.index.spawn.x,
        sz = w.index.spawn.z;
      const heading = Math.atan2(ux, uz);
      const v = (window as any).__kcSpawn(0, 0, { x: sx + ax - ux * 22, z: sz + az - uz * 22, heading });
      await new Promise((res) => setTimeout(res, 1500));
      v.controls.gas = 0.7;
      let minYOnBridge = Infinity;
      let maxAlong = -Infinity;
      const t0 = performance.now();
      while (performance.now() - t0 < 9000) {
        await new Promise((res) => setTimeout(res, 50));
        const p = v.position;
        const along = (p.x - (sx + ax)) * ux + (p.z - (sz + az)) * uz;
        maxAlong = Math.max(maxAlong, along);
        if (along > 2 && along < 12) minYOnBridge = Math.min(minYOnBridge, p.y);
      }
      v.controls.gas = 0;
      return { minYOnBridge, maxAlong };
    },
    { ax, az, ux, uz },
  );
  console.log(JSON.stringify(r));
  // Über die ganze Brücke gefahren und dabei auf Deckhöhe geblieben (Kander-Bett liegt deutlich tiefer)
  expect(r.maxAlong).toBeGreaterThan(len + 3);
  expect(r.minYOnBridge).toBeGreaterThan(343.6);
});
