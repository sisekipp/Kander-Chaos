import { expect, test } from '@playwright/test';
import { firstVisit } from './helpers.ts';

test('Einfach-Modus lässt sich im Menü umschalten und bleibt gespeichert', async ({ page }) => {
  await firstVisit(page);
  const box = page.getByRole('checkbox', { name: /Einfach fahren/ });
  await expect(box).toBeChecked(); // Standard: an
  await box.uncheck();
  await page.reload();
  await expect(page.getByRole('checkbox', { name: /Einfach fahren/ })).not.toBeChecked();
  expect(await page.evaluate(() => (window as any).__kc.store.getState().simpleDriving)).toBe(false);
});
