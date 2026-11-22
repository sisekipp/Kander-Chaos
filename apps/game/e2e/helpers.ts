import type { Page } from '@playwright/test';

/** Erwartet keine Anfragen an fremde Hosts (Spec: Spiel läuft ohne Backend/CDN). */
export function trackForeignRequests(page: Page, baseURL: string): string[] {
  const foreign: string[] = [];
  const own = new URL(baseURL).host;
  page.on('request', (r) => {
    const u = new URL(r.url());
    if ((u.protocol === 'http:' || u.protocol === 'https:') && u.host !== own) foreign.push(r.url());
  });
  return foreign;
}

/** Erster Besuch bis "Bereit zum Offline-Spielen" und weiter ins Menü. */
export async function firstVisit(
  page: Page,
  query = '?debug',
  opts: { waitForServiceWorker?: boolean } = {},
): Promise<void> {
  await page.goto(`/${query}`);
  await page.getByText('Bereit zum Offline-Spielen').waitFor({ timeout: 90_000 });
  await page.getByRole('button', { name: 'Los geht’s' }).click();
  await page.getByRole('button', { name: 'Testmodus' }).waitFor();
  if (opts.waitForServiceWorker === false) return;
  // Service Worker muss die Seite kontrollieren, bevor offline getestet wird
  await page
    .waitForFunction(
      async () => !!(await navigator.serviceWorker.ready) && !!navigator.serviceWorker.controller,
      null,
      { timeout: 30_000 },
    )
    .catch(async () => {
      await page.reload();
      await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30_000 });
    });
}

/** Wartet, bis die Spielfigur steuerbar ist (Kollision der Startkachel geladen). */
export async function waitPlayable(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const kc = (window as unknown as { __kc?: { getWorld(): { player: { isFrozen: boolean } } | null } }).__kc;
      const w = kc?.getWorld();
      return !!w && !w.player.isFrozen;
    },
    null,
    { timeout: 90_000 },
  );
}
