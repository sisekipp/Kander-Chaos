import { expect, test } from '@playwright/test';
import { firstVisit, waitPlayable } from './helpers.ts';

test.setTimeout(300_000);

/** Hubschrauber über eine Stelle setzen, Kacheln abwarten; liefert die Detailstufe der Kachel darunter. */
async function hoverAndCollect(page: import('@playwright/test').Page, x: number, z: number, heading: number) {
  return page.evaluate(
    async ({ x, z, heading }) => {
      const kc = (window as any).__kc;
      const w = kc.getWorld();
      const h = w.heli.active;
      h.state = {
        ...h.state,
        x: x - Math.sin(heading) * 120,
        z: z - Math.cos(heading) * 120,
        y: (w.tiles.heightAt(x, z) ?? 270) + 25,
        vx: 0,
        vy: 0,
        vz: 0,
        high: false,
        grounded: false,
        heading,
      };
      kc.getGame().camera.alpha = -heading - Math.PI / 2;
      await new Promise((r) => setTimeout(r, 1500)); // neu planen lassen
      for (let k = 0; k < 120 && !w.tiles.isSettled; k++) await new Promise((r) => setTimeout(r, 500));
      await new Promise((r) => setTimeout(r, 2000));
      return w.tiles.tileAt(x, z)?.ring ?? null;
    },
    { x, z, heading },
  );
}

test('Piste am EuroAirport mit Markierungen und Autobahn bei Weil (Screenshots)', async ({ page }) => {
  await firstVisit(page);
  await page.getByRole('button', { name: 'Testmodus' }).click();
  await waitPlayable(page);
  // in den Hubschrauber am Landeplatz Kandern
  await page.evaluate(async () => {
    const w = (window as any).__kc.getWorld();
    const pad = (await fetch('/world/helipads.json').then((r) => r.json())).helipads.find(
      (p: any) => p.id === 'kandern',
    );
    w.player.teleport(pad.x + 5, pad.z);
    for (let k = 0; k < 120 && !w.heli.canEnter; k++) await new Promise((r) => setTimeout(r, 500));
    w.heli.enter();
    await new Promise((r) => setTimeout(r, 3500));
  });
  // Querpiste EuroAirport (aus den Kacheldaten), Blick entlang der Piste
  const runway = await hoverAndCollect(page, -9500, -13449, Math.atan2(-363, -77));
  await page.screenshot({ path: 'test-results/airport-runway.png' });
  expect(runway).toBe(0); // volle Details: Straßen-Layer mit Pistenmarkierung
  // A5 bei Weil am Rhein
  const motorway = await hoverAndCollect(page, -4603, -13152, Math.atan2(1, -13));
  await page.screenshot({ path: 'test-results/motorway-weil.png' });
  expect(motorway).toBe(0);
});
