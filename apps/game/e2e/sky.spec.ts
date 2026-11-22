import { expect, test, type Page } from '@playwright/test';
import { firstVisit, waitPlayable } from './helpers.ts';

test.setTimeout(240_000);

/**
 * Löscht den Farbpuffer auf Magenta, rendert ein Bild (ohne Auto-Clear) und zählt verbliebene
 * Magenta-Pixel. Jedes Pixel muss vom Himmel oder von der Welt übermalt sein.
 */
const magentaPixels = (page: Page, beta: number) =>
  page.evaluate((beta) => {
    const game = (window as any).__kc.getGame();
    const { engine, scene, camera } = game;
    camera.beta = beta;
    scene.render();
    const gl = engine._gl as WebGL2RenderingContext;
    gl.clearColor(1, 0, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    scene.render();
    const w = gl.drawingBufferWidth,
      h = gl.drawingBufferHeight;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let magenta = 0;
    for (let i = 0; i < px.length; i += 4) if (px[i] > 250 && px[i + 1] < 5 && px[i + 2] > 250) magenta++;
    return { magenta, autoClear: scene.autoClear, total: w * h };
  }, beta);

test('Himmel deckt jedes Pixel ab (kein Farb-Clear nötig)', async ({ page }) => {
  await firstVisit(page, '?debug', { waitForServiceWorker: false });
  await page.getByRole('button', { name: 'Testmodus' }).click();
  await waitPlayable(page);
  await page.waitForFunction(() => (window as any).__kc.getWorld()?.tiles.isSettled, null, { timeout: 120_000 });
  // Blick schräg nach unten, waagerecht und steil nach oben
  for (const beta of [1.1, 1.55, 2.6]) {
    const r = await magentaPixels(page, beta);
    expect(r.autoClear).toBe(false);
    expect(r.total).toBeGreaterThan(0);
    expect(r.magenta, `beta ${beta}`).toBe(0);
  }
});
