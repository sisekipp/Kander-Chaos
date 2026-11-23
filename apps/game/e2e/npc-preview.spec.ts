import { expect, test, type Page } from '@playwright/test';
import { firstVisit, waitPlayable } from './helpers.ts';

/** Mittlere Draw Calls über einige Bilder (Szeneninstrumentierung der Leistungsanzeige). */
const drawCalls = (page: Page) =>
  page.evaluate(async () => {
    const instr = (window as any).__kc.getGame().perf.sceneInstr;
    let sum = 0;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      sum += instr.drawCallsCounter.current;
    }
    return sum / 20;
  });

test('NPC-Testansicht: 8 Figurmodelle mit gebackener Animation, Draw Calls ≤ Anzahl Figurmodelle', async ({ page }) => {
  await firstVisit(page);
  await page.getByRole('button', { name: 'Testmodus' }).click();
  await waitPlayable(page);
  // freie Wiese bei Wollbach, Kamera ruhig
  await page.evaluate(() => (window as any).__kc.getWorld().player.teleport(-1375, -5480));
  await waitPlayable(page);
  await page.waitForTimeout(3000);
  await page.getByTestId('npc-preview').click();
  await page.waitForFunction(
    () => (window as any).__kc.getGame().scene.meshes.filter((m: any) => m.bakedVertexAnimationManager).length >= 8,
  );
  await page.waitForTimeout(500);
  const info = await page.evaluate(() => {
    const scene = (window as any).__kc.getGame().scene;
    const meshes = scene.meshes.filter((m: any) => m.bakedVertexAnimationManager);
    const vp = scene.activeCamera.getTransformationMatrix().m;
    // Jede Figur im Bild? Weltlage je Thin Instance in Bildschirmkoordinaten (−1 … 1) projizieren
    let visible = 0;
    for (const m of meshes)
      for (const w of m.thinInstanceGetWorldMatrices()) {
        const wm = w.multiply(m.getWorldMatrix()).m;
        const [x, y, z] = [wm[12], wm[13] + 0.9, wm[14]];
        const cx = x * vp[0] + y * vp[4] + z * vp[8] + vp[12];
        const cy = x * vp[1] + y * vp[5] + z * vp[9] + vp[13];
        const cw = x * vp[3] + y * vp[7] + z * vp[11] + vp[15];
        if (cw > 0 && Math.abs(cx / cw) < 1 && Math.abs(cy / cw) < 1) visible++;
      }
    return {
      models: meshes.length,
      figures: meshes.reduce((s: number, m: any) => s + m.thinInstanceCount, 0),
      subMeshes: meshes.reduce((s: number, m: any) => s + m.subMeshes.length, 0),
      textures: meshes.every((m: any) => m.bakedVertexAnimationManager.texture?.isReady()),
      skeletonsAnimated: scene.animationGroups.filter((g: any) => g.name.startsWith('npc-') && g.isPlaying).length,
      // nicht zusätzlich in Schattenkarten oder anderen Render-Targets (sonst mehr als ein Draw Call je Modell)
      inTargets: [
        ...scene.customRenderTargets,
        ...scene.lights.map((l: any) => l.getShadowGenerator?.()?.getShadowMap?.()).filter(Boolean),
      ].some((t: any) => (t.renderList ?? []).some((m: any) => meshes.includes(m))),
      visible,
    };
  });
  expect(info.models).toBe(8);
  expect(info.figures).toBeGreaterThanOrEqual(8);
  expect(info.visible).toBe(info.figures);
  expect(info.subMeshes).toBe(info.models); // ein Draw Call je Figurmodell
  expect(info.textures).toBe(true);
  expect(info.skeletonsAnimated).toBe(0); // keine Skelettanimation auf der CPU
  expect(info.inTargets).toBe(false);
  await page.screenshot({ path: test.info().outputPath('npc-preview.png') });

  // Draw Calls der Ansicht: an – aus – an (gleicht Schwankungen durch das Nachladen von Kacheln aus)
  const count = () =>
    page.evaluate(
      () => (window as any).__kc.getGame().scene.meshes.filter((m: any) => m.bakedVertexAnimationManager).length,
    );
  const on1 = await drawCalls(page);
  await page.getByTestId('npc-preview').click();
  await expect.poll(count).toBe(0); // Ausschalten räumt auf
  const off = await drawCalls(page);
  await page.getByTestId('npc-preview').click();
  await expect.poll(count).toBe(8);
  await page.waitForTimeout(500);
  const on2 = await drawCalls(page);
  console.log(`Draw Calls: an ${on1.toFixed(1)}, aus ${off.toFixed(1)}, an ${on2.toFixed(1)}`);
  expect(Math.min(on1, on2) - off).toBeLessThanOrEqual(info.models + 0.5);
});
