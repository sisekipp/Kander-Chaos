import { expect, test } from '@playwright/test';
import { firstVisit, waitPlayable } from './helpers.ts';

test.setTimeout(300_000);

test('Fernsicht: aus 300 m über Kandern sind Basler Hochhäuser als Silhouetten da, wenige zusätzliche Draw Calls', async ({
  page,
}) => {
  await firstVisit(page);
  await page.getByRole('button', { name: 'Testmodus' }).click();
  await waitPlayable(page);
  const r = await page.evaluate(async () => {
    const kc = (window as any).__kc;
    const w = kc.getWorld();
    const pads = (await fetch('/world/helipads.json').then((x) => x.json())).helipads;
    const lo = pads.find((p: any) => p.id === 'kandern');
    const scene = kc.getGame().scene;
    const calls = () => scene.getEngine()._drawCalls?.current ?? 0;
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    // Bezugswert im Flug ohne Silhouetten: Fernsicht abschalten
    w.player.teleport(lo.x, lo.z);
    await wait(3000);
    w.startFlying();
    const fc = w.fly.controllerState;
    fc.state = { ...fc.state, x: lo.x, z: lo.z, y: (w.tiles.heightAt(lo.x, lo.z) ?? 300) + 300, vx: 0, vz: 0 };
    for (let k = 0; k < 120 && !w.tiles.isSettled; k++) await wait(500);
    await wait(2500);
    const far = w.far;
    const sky = (await fetch('/world/skyline.json').then((x) => x.json())).buildings;
    const roche = sky.find((b: any) => b.h > 150);
    const withFar = calls();
    far.setActive(false);
    await wait(500);
    const without = calls();
    far.setActive(true);
    await wait(1500);
    return {
      active: far.isActive,
      count: far.silhouetteCount,
      rocheDist: Math.hypot(roche.x - lo.x, roche.z - lo.z),
      extra: withFar - without,
    };
  });
  console.log(JSON.stringify(r));
  expect(r.active).toBe(true);
  expect(r.rocheDist).toBeGreaterThan(12000); // Basel liegt jenseits der früheren Sichtgrenze
  expect(r.count).toBeGreaterThan(0);
  expect(r.extra).toBeLessThanOrEqual(30);
});
