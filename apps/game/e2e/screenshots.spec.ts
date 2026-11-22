import { expect, test } from '@playwright/test';
import { firstVisit, waitPlayable } from './helpers.ts';

test.setTimeout(420_000);

/** Orte der Sichtprüfung (Versatz zum Blumenplatz in m) und Kameraeinstellung. */
const SPOTS = [
  { name: 'blumenplatz', dx: 0, dz: 0, radius: 32, beta: 0.95, alpha: -1.0 },
  { name: 'hauptstrasse', dx: 133.5, dz: 84.5, radius: 24, beta: 0.95, alpha: -0.6 },
  { name: 'feldweg', dx: -243, dz: 656, radius: 45, beta: 1.05, alpha: -1.2 },
  { name: 'kirche', dx: -11, dz: 44, radius: 110, beta: 1.25, alpha: -2.2 },
  { name: 'bruecke', dx: -112, dz: -190, radius: 30, beta: 1.05, alpha: 0.4 },
  { name: 'kreisverkehr', dx: -312, dz: -181, radius: 45, beta: 0.6, alpha: -1.2 },
];

/**
 * Legt Screenshots der Sichtprüfungs-Orte im Testlauf ab (Anhänge im Bericht, Dateien unter test-results).
 * Bewertet wird von Menschen; der Test prüft nur, dass jedes Bild Inhalt hat.
 */
test('Screenshots für die Sichtprüfung: Blumenplatz, Hauptstraße, Feldweg, Kirche, Brücke, Kreisverkehr', async ({
  page,
}, info) => {
  await firstVisit(page, '?debug', { waitForServiceWorker: false });
  await page.getByRole('button', { name: 'Testmodus' }).click();
  await waitPlayable(page);
  await page.addStyleTag({ content: 'button, .toast, .panel { visibility: hidden !important; }' });
  for (const s of SPOTS) {
    await page.evaluate((s) => {
      const kc = (window as any).__kc;
      const w = kc.getWorld();
      w.player.teleport(w.index.spawn.x + s.dx, w.index.spawn.z + s.dz);
    }, s);
    await page.waitForFunction(
      () => {
        const w = (window as any).__kc.getWorld();
        return w.tiles.isSettled && !w.player.isFrozen;
      },
      null,
      { timeout: 90_000, polling: 300 },
    );
    await page.evaluate((s) => {
      const g = (window as any).__kc.getGame();
      g.camera.upperRadiusLimit = 800;
      g.camera.radius = s.radius;
      g.camera.beta = s.beta;
      g.camera.alpha = s.alpha;
    }, s);
    await page.waitForTimeout(1200);
    const png = await page.locator('canvas').first().screenshot({ path: info.outputPath(`${s.name}.png`) });
    await info.attach(s.name, { body: png, contentType: 'image/png' });
    expect(png.length, s.name).toBeGreaterThan(20_000);
  }
});
