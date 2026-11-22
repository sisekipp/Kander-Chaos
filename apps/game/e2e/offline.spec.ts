import { expect, test } from '@playwright/test';
import { firstVisit, trackForeignRequests, waitPlayable } from './helpers.ts';

test('erster Besuch lädt alles, danach startet das Spiel offline ohne fremde Hosts', async ({
  page,
  context,
  baseURL,
}) => {
  const foreign = trackForeignRequests(page, baseURL!);
  await expect(page.locator('body')).toBeVisible();
  await firstVisit(page);

  await context.setOffline(true);
  await page.reload();
  // Offline: keine Download-Anzeige, direkt ins Menü
  await page.getByRole('button', { name: 'Testmodus' }).click();
  await waitPlayable(page);

  // Über das Spiel ist offline erreichbar und nennt OSM und LGL
  await page.getByRole('button', { name: 'Menü' }).click();
  await page.getByRole('button', { name: 'Über das Spiel' }).click();
  await expect(page.getByText('© OpenStreetMap-Mitwirkende')).toBeVisible();
  await expect(page.getByText(/Datenquelle: LGL/)).toBeVisible();
  expect(foreign).toEqual([]);
});

test.describe('Downloader ohne Service Worker', () => {
  // Playwright sieht in WebKit keine Anfragen, die ein Service Worker weiterreicht. Die Downloader-Logik
  // ist identisch; der Service Worker wird hier blockiert, damit die Netzwerkfehler gezielt auslösbar sind.
  test.use({ serviceWorkers: 'block' });
  test('abgebrochener Download behält geladene Pakete und setzt fort', async ({ page }) => {
    let failOnce = true;
    let packRequests = 0;
    await page.route(/\/world\/region_.*\.bin$/, async (route) => {
      packRequests++;
      if (failOnce && packRequests === 3) {
        failOnce = false;
        await route.abort('internetdisconnected');
        return;
      }
      await route.continue();
    });
    await page.goto('/?debug');
    await expect(page.getByText(/Download unterbrochen/)).toBeVisible({ timeout: 90_000 });
    const firstAttempt = packRequests;
    await page.getByRole('button', { name: 'Erneut versuchen' }).click();
    await expect(page.getByText('Bereit zum Offline-Spielen')).toBeVisible({ timeout: 90_000 });
    const total = await page.evaluate(
      async () => (await (await fetch('/world/index.json')).json()).packs.length as number,
    );
    // Zweiter Versuch lädt nur, was fehlte (die 2 vor dem Abbruch fertigen Pakete nicht erneut)
    expect(packRequests - firstAttempt).toBe(total - 2);
  });
});
