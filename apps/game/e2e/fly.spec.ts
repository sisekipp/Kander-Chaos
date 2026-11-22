import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { firstVisit, waitPlayable } from './helpers.ts';

test.setTimeout(300_000);

async function setup(page: Page) {
  await firstVisit(page);
  await page.getByRole('button', { name: 'Testmodus' }).click();
  await waitPlayable(page);
  await page.waitForFunction(() => (window as any).__kc.getWorld().tiles.isSettled, null, {
    timeout: 120_000,
    polling: 300,
  });
}

async function takeOff(page: Page) {
  await page.getByRole('button', { name: 'Fliegen' }).dispatchEvent('pointerdown');
  await expect(page.getByRole('button', { name: 'Hier landen' })).toBeVisible();
  await page.waitForFunction(() => (window as any).__kc.getWorld().flying);
}

/** Setzt die Flugkamera direkt (Testabkürzung statt minutenlangem Fliegen); y = Höhe über Gelände. */
const placeCamera = (page: Page, x: number | null, z: number | null, altitude: number) =>
  page.evaluate(
    ({ x, z, altitude }) => {
      const w = (window as any).__kc.getWorld();
      const c = w.fly.controllerState;
      const s = c.state;
      const nx = x ?? s.x,
        nz = z ?? s.z;
      const ground = w.tiles.heightAt(nx, nz) ?? c.ground;
      c.state = { ...s, x: nx, z: nz, y: ground + altitude, vx: 0, vy: 0, vz: 0 };
    },
    { x, z, altitude },
  );

const settled = (page: Page) =>
  page.waitForFunction(() => (window as any).__kc.getWorld().tiles.isSettled, null, {
    timeout: 120_000,
    polling: 300,
  });

const detail = (page: Page) =>
  page.evaluate(() => {
    const w = (window as any).__kc.getWorld();
    let ring0 = 0;
    for (const t of w.tiles.tiles) if (t.ring === 0) ring0++;
    return { ring0, props: w.props.tileCount, vehicles: w.vehicles?.count ?? 0 };
  });

test('Flug: in 200 m Höhe keine volle Detailstufe, beim Sinken kommt sie zurück', async ({ page }) => {
  await setup(page);
  expect((await detail(page)).ring0).toBeGreaterThan(0);
  await takeOff(page);
  await placeCamera(page, null, null, 200);
  await page.waitForTimeout(500);
  await settled(page);
  const high = await detail(page);
  await placeCamera(page, null, null, 30);
  await page.waitForTimeout(500);
  await settled(page);
  const low = await detail(page);
  console.log(JSON.stringify({ high, low }));
  expect(high).toEqual({ ring0: 0, props: 0, vehicles: 0 });
  expect(low.ring0).toBeGreaterThan(0);
  expect(low.props).toBeGreaterThan(0);
});

test('Flug: „Zurück“ setzt die Figur an den Startpunkt und sie läuft sofort', async ({ page }) => {
  await setup(page);
  const start = await page.evaluate(() => {
    const p = (window as any).__kc.getWorld().player.position;
    return { x: p.x, z: p.z };
  });
  await takeOff(page);
  // ein Stück fliegen: vorwärts und steigen
  await page.evaluate(async () => {
    const i = (window as any).__kc.input;
    i.moveY = 1;
    i.flyUp = true;
    await new Promise((r) => setTimeout(r, 2000));
    i.moveY = 0;
    i.flyUp = false;
  });
  const cam = await page.evaluate(() => (window as any).__kc.getWorld().fly.controllerState.state);
  expect(Math.hypot(cam.x - start.x, cam.z - start.z)).toBeGreaterThan(5);
  await page.getByRole('button', { name: 'Zurück' }).dispatchEvent('pointerdown');
  await expect(page.getByRole('button', { name: 'Fliegen' })).toBeVisible();
  const r = await page.evaluate(async () => {
    const w = (window as any).__kc.getWorld();
    const p0 = w.player.position.clone();
    const i = (window as any).__kc.input;
    i.moveY = 1;
    await new Promise((r) => setTimeout(r, 1000));
    i.moveY = 0;
    const p1 = w.player.position;
    return { x: p0.x, z: p0.z, moved: Math.hypot(p1.x - p0.x, p1.z - p0.z), flying: w.flying };
  });
  console.log(JSON.stringify(r));
  expect(r.flying).toBe(false);
  expect(Math.hypot(r.x - start.x, r.z - start.z)).toBeLessThan(0.5);
  expect(r.moved).toBeGreaterThan(0.5);
});

test('Flug: „Hier landen“ über Wollbach setzt die Figur dort auf den Boden', async ({ page }) => {
  await setup(page);
  const target = await page.evaluate(() => {
    const p = (window as any).__kc.getWorld().places.find((q: any) => q.name === 'Wollbach');
    return { x: p.x, z: p.z };
  });
  await takeOff(page);
  await placeCamera(page, target.x, target.z, 60);
  await page.waitForFunction(({ x, z }) => (window as any).__kc.getWorld().tiles.heightAt(x, z) !== null, target, {
    timeout: 60_000,
  });
  await placeCamera(page, target.x, target.z, 60);
  await page.getByRole('button', { name: 'Hier landen' }).dispatchEvent('pointerdown');
  await waitPlayable(page);
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const w = (window as any).__kc.getWorld();
    const p = w.player.position;
    return { x: p.x, z: p.z, y: p.y, ground: w.tiles.heightAt(p.x, p.z), flying: w.flying };
  });
  console.log(JSON.stringify(r));
  expect(r.flying).toBe(false);
  expect(Math.hypot(r.x - target.x, r.z - target.z)).toBeLessThan(25);
  expect(Math.abs(r.y - r.ground)).toBeLessThan(1.2);
});

test('Flug: beim Fahren gibt es keinen Knopf „Fliegen“', async ({ page }) => {
  await setup(page);
  await expect(page.getByRole('button', { name: 'Fliegen' })).toBeVisible();
  await page.evaluate(() => {
    const w = (window as any).__kc.getWorld();
    const p = w.player.position;
    const car = [...w.vehicles.all()]
      .filter((v: any) => v.kind === 0)
      .sort(
        (a: any, b: any) =>
          Math.hypot(a.position.x - p.x, a.position.z - p.z) - Math.hypot(b.position.x - p.x, b.position.z - p.z),
      )[0];
    const h = car.sim.heading;
    w.player.teleport(car.position.x - Math.cos(h) * 2, car.position.z + Math.sin(h) * 2);
  });
  await waitPlayable(page);
  await page.getByRole('button', { name: 'Einsteigen' }).dispatchEvent('pointerdown');
  await expect(page.getByRole('button', { name: 'Gas' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fliegen' })).toHaveCount(0);
});

test('Flug: beim Schnellflug ist unter der Kamera immer Gelände geladen', async ({ page }) => {
  await setup(page);
  await takeOff(page);
  await placeCamera(page, null, null, 150);
  const r = await page.evaluate(async () => {
    const kc = (window as any).__kc;
    const w = kc.getWorld();
    const s = w.fly.controllerState.state;
    const to = w.places.find((q: any) => q.name === 'Wollbach');
    const yaw = Math.atan2(to.x - s.x, to.z - s.z);
    kc.getGame().camera.alpha = -yaw - Math.PI / 2;
    kc.getGame().camera.beta = Math.PI / 2;
    kc.input.fast = true;
    kc.input.moveY = 1;
    let samples = 0,
      holes = 0,
      maxSpeed = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < 12_000) {
      await new Promise((r) => setTimeout(r, 100));
      const c = w.fly.controllerState.state;
      samples++;
      if (!w.tiles.tileAt(c.x, c.z)) holes++; // irgendeine Detailstufe = Gelände sichtbar
      maxSpeed = Math.max(maxSpeed, Math.hypot(c.vx, c.vz));
    }
    kc.input.fast = false;
    kc.input.moveY = 0;
    const e = w.fly.controllerState.state;
    return { samples, holes, maxSpeed, dist: Math.hypot(e.x - s.x, e.z - s.z) };
  });
  console.log(JSON.stringify(r));
  expect(r.dist).toBeGreaterThan(200);
  expect(r.maxSpeed).toBeLessThanOrEqual(50.5);
  expect(r.holes).toBe(0);
});

/**
 * Messroute „Flug“ (Runde über der Kernstadt, Schnellflug nach Wollbach, Tiefflug zurück): läuft ohne Eingriff
 * durch und liefert einen Messbericht. Desktop-Werte (Playwright-WebKit) ersetzen NICHT die iPad-Messung.
 */
test('Messroute „Flug“ läuft durch, ohne Löcher unter der Kamera, und liefert einen Messbericht', async ({
  page,
}, info) => {
  test.setTimeout(600_000);
  await setup(page);
  const download = page.waitForEvent('download', { timeout: 560_000 });
  await page.getByRole('button', { name: 'Flug', exact: true }).click();
  await expect(page.getByText(/Messfahrt Kandern → Wollbach läuft/)).toBeVisible();
  // Löcher zählen, solange die Route läuft
  const holes = page.evaluate(async () => {
    const w = (window as any).__kc.getWorld();
    let n = 0,
      samples = 0;
    while (w.routeActive) {
      const c = w.fly?.controllerState?.state;
      if (c) {
        samples++;
        if (!w.tiles.tileAt(c.x, c.z)) n++;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    return { holes: n, samples };
  });
  const file = info.outputPath('flug.json');
  await (await download).saveAs(file);
  const report = JSON.parse(readFileSync(file, 'utf8'));
  const h = await holes;
  console.log('Desktop-Messung Flug:', JSON.stringify({ summary: report.summary, extra: report.extra, ...h }));
  expect(report.label).toBe('flug');
  expect(report.summary.frames).toBeGreaterThan(100);
  expect(h.samples).toBeGreaterThan(100);
  expect(h.holes).toBe(0);
  await expect(page.getByRole('button', { name: 'Fliegen' })).toBeVisible();
});
