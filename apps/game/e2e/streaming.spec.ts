import { expect, test, type Page } from '@playwright/test';
import { firstVisit, waitPlayable } from './helpers.ts';

test.setTimeout(240_000);

async function settle(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const w = (window as any).__kc.getWorld();
      return w && w.tiles.isSettled && !w.player.isFrozen;
    },
    null,
    { timeout: 120_000, polling: 500 },
  );
  await page.waitForTimeout(800);
}

const counts = (page: Page) =>
  page.evaluate(() => {
    const s = (window as any).__kc.getGame().scene;
    return {
      meshes: s.meshes.length,
      nodes: s.transformNodes.length,
      geometries: s.geometries.length,
      tiles: (window as any).__kc.getWorld().tiles.loadedCount,
    };
  });

test('Streaming lässt nach Hin- und Rückfahrt keine Meshes, Knoten oder Geometrien zurück', async ({ page }) => {
  await firstVisit(page);
  await page.getByRole('button', { name: 'Testmodus' }).click();
  await waitPlayable(page);
  await settle(page);
  const before = await counts(page);
  await page.evaluate(() => {
    const w = (window as any).__kc.getWorld();
    w.player.teleport(w.index.spawn.x + 2500, w.index.spawn.z + 1500);
  });
  await settle(page);
  const far = await counts(page);
  await page.evaluate(() => {
    const w = (window as any).__kc.getWorld();
    w.player.teleport(w.index.spawn.x, w.index.spawn.z);
  });
  await settle(page);
  const after = await counts(page);
  console.log(JSON.stringify({ before, far, after }));
  expect(after).toEqual(before);
});
