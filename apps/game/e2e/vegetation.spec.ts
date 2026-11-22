import { expect, test } from '@playwright/test';
import { firstVisit, waitPlayable } from './helpers.ts';

test.setTimeout(240_000);

test('Bäume: höchstens 5 Draw Calls je Kachel, Tönung je Baum', async ({ page }) => {
  await firstVisit(page, '?debug', { waitForServiceWorker: false });
  await page.getByRole('button', { name: 'Testmodus' }).click();
  await waitPlayable(page);
  await page.waitForFunction(() => (window as any).__kc.getWorld()?.tiles.isSettled, null, { timeout: 120_000 });
  const r = await page.evaluate(() => {
    const scene = (window as any).__kc.getGame().scene;
    const perTile = new Map<string, number>();
    let withTint = 0,
      total = 0;
    for (const m of scene.meshes) {
      const match = /^trees(\d)-(.+)$/.exec(m.name);
      if (!match) continue;
      total++;
      perTile.set(match[2], (perTile.get(match[2]) ?? 0) + 1);
      if (m.isVerticesDataPresent('instanceColor')) withTint++;
    }
    return { max: Math.max(...perTile.values()), tiles: perTile.size, total, withTint };
  });
  console.log(JSON.stringify(r));
  expect(r.tiles).toBeGreaterThan(0);
  expect(r.max).toBeLessThanOrEqual(5);
  expect(r.withTint).toBe(r.total);
});
