import { expect, test, type Page } from '@playwright/test';
import { firstVisit, waitPlayable } from './helpers.ts';

test.setTimeout(240_000);

/** Liest direkt nach einem gerenderten Bild Pixel aus und zählt unterschiedliche Farben. */
const renderedColors = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const game = (window as any).__kc.getGame();
        game.scene.onAfterRenderObservable.addOnce(() => {
          const gl = game.engine._gl as WebGL2RenderingContext;
          const w = gl.drawingBufferWidth,
            h = gl.drawingBufferHeight;
          const px = new Uint8Array(w * h * 4);
          gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
          const seen = new Set<number>();
          for (let i = 0; i < px.length; i += 4 * 97) seen.add((px[i] << 16) | (px[i + 1] << 8) | px[i + 2]);
          resolve(seen.size);
        });
      }),
  );

for (const [query, expectUbo] of [
  ['?debug&ubo=1', true],
  ['?debug&ubo=0', false],
] as const) {
  test(`Welt rendert mit Uniform-Buffern ${expectUbo ? 'an' : 'aus'}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await firstVisit(page, query, { waitForServiceWorker: false });
    await page.getByRole('button', { name: 'Testmodus' }).click();
    await waitPlayable(page);
    await page.waitForFunction(() => (window as any).__kc.getWorld()?.tiles.isSettled, null, { timeout: 120_000 });
    const state = await page.evaluate(() => {
      const g = (window as any).__kc.getGame();
      return { flag: g.uniformBuffers, supports: g.engine.supportsUniformBuffers };
    });
    expect(state.flag).toBe(expectUbo);
    expect(state.supports).toBe(expectUbo);
    await expect(page.getByRole('button', { name: `UBO: ${expectUbo ? 'an' : 'aus'}` })).toBeVisible();
    expect(await renderedColors(page)).toBeGreaterThan(20);
    expect(errors).toEqual([]);
  });
}
