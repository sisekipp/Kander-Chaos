import { expect, test, type Page } from '@playwright/test';
import { firstVisit, waitPlayable } from './helpers.ts';

/** Fahrzeug der gewünschten Art (Zweirad mit Sitzpunkt bzw. Auto) nahe der Figur suchen und daneben stellen. */
async function standNextTo(page: Page, twoWheeler: boolean): Promise<void> {
  await page.evaluate((two) => {
    const w = (window as any).__kc.getWorld();
    const p = w.player.position;
    const v = [...w.vehicles.all()]
      .filter((x: any) => (two ? x.sim.spec.twoWheeler && x.sim.model.seat : x.kind === 0) && !x.wrecked)
      .sort(
        (a: any, b: any) =>
          Math.hypot(a.position.x - p.x, a.position.z - p.z) - Math.hypot(b.position.x - p.x, b.position.z - p.z),
      )[0];
    (window as any).__target = v;
    w.player.teleport(v.position.x + 2.5, v.position.z);
  }, twoWheeler);
  await waitPlayable(page);
}

test('Figur aus dem Modell: Animation wechselt beim Losgehen und beim Einsteigen, sitzt sichtbar auf dem Zweirad', async ({
  page,
}) => {
  await firstVisit(page);
  await page.getByRole('button', { name: 'Testmodus' }).click();
  await waitPlayable(page);
  // Modell statt Kapsel: Skelett, höchstens 3.000 Dreiecke
  const info = await page.evaluate(() => {
    const kc = (window as any).__kc;
    const fig = kc.getWorld().player.walker.figure;
    return {
      animator: !!fig.animator,
      skinned: fig.meshes.some((m: any) => !!m.skeleton),
      triangles: kc.getModels().entry('figure-kid').triangles,
    };
  });
  expect(info.animator).toBe(true);
  expect(info.skinned).toBe(true);
  expect(info.triangles).toBeLessThanOrEqual(3000);
  await page.waitForFunction(() => (window as any).__kc.getWorld().player.walker.figure.animator.clip === 'idle');

  // Losgehen: ab dem Wechsel ins Gehen ist das Stehen nach 0,3 s Spielzeit ausgeblendet (Summe der Bildschritte,
  // unabhängig von der Bildrate im Testbrowser); bei schnellem Antritt geht es danach ins Rennen
  const blend = await page.evaluate(async () => {
    const kc = (window as any).__kc;
    const a = kc.getWorld().player.walker.figure.animator;
    const engine = kc.getGame().engine;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', code: 'KeyW' }));
    const t0 = performance.now();
    let walked = false;
    let ms = 0;
    while ((a.weights.idle ?? 0) > 0 && performance.now() - t0 < 5000) {
      await new Promise((r) => requestAnimationFrame(r));
      if (walked) ms += Math.min(engine.getDeltaTime(), 100);
      walked ||= a.clip === 'walk';
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', code: 'KeyW' }));
    return { ms, walked };
  });
  expect(blend.walked).toBe(true);
  expect(blend.ms).toBeLessThan(400);

  // Einsteigen ins Auto: kurze Einsteige-Animation, dann verschwindet die Figur
  await standNextTo(page, false);
  await page.evaluate(() => (window as any).__kc.getWorld().player.enter((window as any).__target));
  await page.waitForFunction(() => (window as any).__kc.getWorld().player.walker.figure.animator.clip === 'enter');
  expect(await page.evaluate(() => (window as any).__kc.getWorld().player.walker.figure.root.isEnabled())).toBe(true);
  await page.waitForFunction(() => !(window as any).__kc.getWorld().player.walker.figure.root.isEnabled(), null, {
    timeout: 5000,
  });
  await page.evaluate(() => (window as any).__kc.getWorld().player.leaveVehicle(true));
  await page.waitForFunction(() => (window as any).__kc.getWorld().player.walker.figure.animator.clip === 'exit');

  // Zweirad: Figur sitzt sichtbar am Sitzpunkt und neigt sich mit dem Fahrzeug
  await standNextTo(page, true);
  await page.evaluate(() => (window as any).__kc.getWorld().player.enter((window as any).__target));
  await page.waitForFunction(() => (window as any).__kc.getWorld().player.walker.figure.animator.clip === 'sit', null, {
    timeout: 5000,
  });
  const ride = await page.evaluate(() => {
    const w = (window as any).__kc.getWorld();
    const fig = w.player.walker.figure;
    const root = w.player.vehicle.sim.model.root;
    // Neigung simulieren: Fahrzeug um die Längsachse drehen, Figur muss mitgehen
    root.rotationQuaternion = null;
    root.rotation.z = 0.3;
    root.computeWorldMatrix(true);
    fig.model.computeWorldMatrix(true);
    const a = fig.model.getWorldMatrix().m,
      b = root.getWorldMatrix().m;
    const dot = a[4] * b[4] + a[5] * b[5] + a[6] * b[6];
    return { riding: w.player.isRiding, visible: fig.model.isEnabled(), parented: fig.model.parent === root, dot };
  });
  expect(ride.riding).toBe(true);
  expect(ride.visible).toBe(true);
  expect(ride.parented).toBe(true);
  expect(ride.dot).toBeGreaterThan(0.999);
});

test('Figurvariante im Menü wählen: bleibt nach Neustart erhalten', async ({ page, context }) => {
  await firstVisit(page, '?debug&autosave=1000');
  await page.getByTestId('figure-3').click();
  await expect(page.getByTestId('figure-3')).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Testmodus' }).click();
  await waitPlayable(page);
  expect(await page.evaluate(() => (window as any).__kc.getWorld().player.walker.figure.variant)).toBe(3);
  await page.waitForTimeout(2500); // Autosave (1 s im Test)
  await page.close();

  const page2 = await context.newPage();
  await page2.goto('/?debug');
  await expect(page2.getByTestId('figure-3')).toHaveAttribute('aria-checked', 'true');
  await page2.getByRole('button', { name: 'Testmodus' }).click();
  await waitPlayable(page2);
  const v = await page2.evaluate(() => {
    const fig = (window as any).__kc.getWorld().player.walker.figure;
    const shirt = fig.meshes.find((m: any) => m.material?.name === 'player-shirt')?.material.diffuseColor;
    return { variant: fig.variant, shirt: shirt && [shirt.r, shirt.g, shirt.b] };
  });
  expect(v.variant).toBe(3);
  expect(v.shirt?.[0]).toBeCloseTo(0.9, 2); // Variante „Rot“
});
