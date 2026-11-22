import { expect, test } from '@playwright/test';
import { firstVisit, waitPlayable } from './helpers.ts';

test.setTimeout(180_000);

test('am Startpunkt stehen ≥ 5 benutzbare Fahrzeuge inkl. Zweirad im Umkreis von 150 m, verschiedene Modelle, undurchsichtig', async ({
  page,
}) => {
  await firstVisit(page);
  await page.getByRole('button', { name: 'Testmodus' }).click();
  await waitPlayable(page);
  await page.waitForFunction(
    () => {
      const w = (window as any).__kc.getWorld();
      return w.tiles.isSettled && w.vehicles.count > 0;
    },
    null,
    { timeout: 60_000, polling: 300 },
  );
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const w = (window as any).__kc.getWorld();
    const p = w.player.position;
    const near = [...w.vehicles.all()].filter((v: any) => Math.hypot(v.position.x - p.x, v.position.z - p.z) <= 150);
    return {
      total: w.vehicles.count,
      dynamic: w.vehicles.dynamicCount,
      near: near.length,
      twoWheelers: near.filter((v: any) => v.kind !== 0).length,
      // undurchsichtig: kein Mesh im Transparenz-Durchgang (sonst fehlen Dach/Glas scheinbar)
      alphaMeshes: near.flatMap((v: any) => v.sim.model.root.getChildMeshes(false)).filter((m: any) => m.hasVertexAlpha)
        .length,
      models: new Set(near.map((v: any) => v.modelId)).size,
    };
  });
  console.log(JSON.stringify(info));
  expect(info.near).toBeGreaterThanOrEqual(5);
  expect(info.twoWheelers).toBeGreaterThanOrEqual(1);
  expect(info.total).toBeLessThanOrEqual(24);
  expect(info.dynamic).toBeLessThanOrEqual(8);
  expect(info.alphaMeshes).toBe(0);
  expect(info.models).toBeGreaterThanOrEqual(4);
});
