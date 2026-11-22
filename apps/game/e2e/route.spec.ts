import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { firstVisit, waitPlayable } from './helpers.ts';

test.setTimeout(420_000);

/**
 * Messfahrt Kernstadt -> Landstraße -> Ortsteil (Kandern -> Holzen -> Riedlingen) mit 80 km/h:
 * läuft ohne Eingriff durch und liefert einen JSON-Bericht. Leistungswerte hier sind Desktop-Werte
 * (Playwright-WebKit) und ersetzen NICHT die Abnahmemessung auf dem iPad.
 */
test('Testroute läuft ohne Eingriff durch und liefert einen Messbericht', async ({ page }, info) => {
  await firstVisit(page);
  await page.getByRole('button', { name: 'Testmodus' }).click();
  await waitPlayable(page);
  const download = page.waitForEvent('download', { timeout: 400_000 });
  await page.getByRole('button', { name: 'Testroute' }).click();
  await expect(page.getByText(/Messfahrt Kandern → Holzen → Riedlingen läuft/)).toBeVisible();
  const file = info.outputPath('testroute.json');
  await (await download).saveAs(file);
  const report = JSON.parse(readFileSync(file, 'utf8'));
  expect(report.label).toBe('testroute');
  expect(report.summary.frames).toBeGreaterThan(100);
  await expect(page.getByText(/Fertig: Ø/)).toBeVisible();
  const ready = await page.evaluate(() => {
    const w = (window as any).__kc.getWorld();
    const p = w.player.position;
    return { ring0Here: w.tiles.isReady(p.x, p.z), tiles: w.tiles.loadedCount };
  });
  console.log('Desktop-Messung:', JSON.stringify({ summary: report.summary, extra: report.extra, ...ready }));
  expect(ready.tiles).toBeLessThanOrEqual(90);
});
