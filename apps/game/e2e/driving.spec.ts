import { expect, test, type Page } from '@playwright/test';
import { firstVisit, waitPlayable } from './helpers.ts';

test.setTimeout(240_000);

const WALL = { x: -102.3, z: 128.6, heading: 2.085 }; // freie Hauswand nahe dem Blumenplatz (siehe vehicle-physics.spec)

async function setup(page: Page) {
  await firstVisit(page);
  await page.getByRole('button', { name: 'Testmodus' }).click();
  await waitPlayable(page);
  await page.waitForFunction(
    () => {
      const w = (window as any).__kc.getWorld();
      return w.tiles.isSettled && w.vehicles.count > 0;
    },
    null,
    { timeout: 60_000, polling: 300 },
  );
}

/** Stellt die Figur 2 m neben das nächste geparkte Auto. */
async function nextToCar(page: Page) {
  return page.evaluate(() => {
    const w = (window as any).__kc.getWorld();
    const p = w.player.position;
    const cars = [...w.vehicles.all()]
      .filter((v: any) => v.kind === 0)
      .sort(
        (a: any, b: any) =>
          Math.hypot(a.position.x - p.x, a.position.z - p.z) - Math.hypot(b.position.x - p.x, b.position.z - p.z),
      );
    const car = cars[0];
    const h = car.sim.heading;
    w.player.teleport(car.position.x - Math.cos(h) * 2, car.position.z + Math.sin(h) * 2);
    return car.id;
  });
}

test('Einsteigen in Reichweite, Fahren im Einfach-Modus, Aussteigen; Bedienelemente wechseln', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => (window as any).__kc.getWorld().player.teleport(9999, 9999)); // weit weg von allem
  await page.waitForTimeout(500);
  await expect(page.getByRole('button', { name: 'Einsteigen' })).toHaveCount(0);
  await page.evaluate(() => {
    const w = (window as any).__kc.getWorld();
    const s = w.index.spawn;
    w.player.teleport(s.x, s.z);
  });
  await waitPlayable(page);
  await page.waitForFunction(() => (window as any).__kc.getWorld().vehicles.count > 0, null, { timeout: 30_000 });
  const carId = await nextToCar(page);
  await waitPlayable(page);
  await expect(page.getByRole('button', { name: 'Einsteigen' })).toBeVisible();
  await page.getByRole('button', { name: 'Einsteigen' }).dispatchEvent('pointerdown');
  await expect(page.getByRole('button', { name: 'Gas' })).toBeVisible();
  await expect(page.getByRole('meter', { name: 'Fahrzeugzustand' })).toBeVisible();
  const driven = await page.evaluate(() => (window as any).__kc.getWorld().player.vehicle?.id);
  expect(driven).toBe(carId);
  // Einfach-Modus: nur lenken -> Auto fährt
  await page.evaluate(() => {
    (window as any).__kc.input.moveX = 0.4;
  });
  await page.waitForTimeout(2500);
  const speed = await page.evaluate(() => {
    (window as any).__kc.input.moveX = 0;
    return (window as any).__kc.getWorld().player.vehicle.speed * 3.6;
  });
  expect(speed).toBeGreaterThan(8);
  // Aussteigen bei Tempo: erst bremsen, dann aussteigen
  await page.getByRole('button', { name: 'Aussteigen' }).dispatchEvent('pointerdown');
  await page.waitForFunction(() => (window as any).__kc.getWorld().player.state.kind === 'walking', null, {
    timeout: 15_000,
  });
  await expect(page.getByRole('button', { name: 'Springen' })).toBeVisible();
});

test('Aussteigen mit der Fahrerseite an einer Hauswand landet auf freiem Boden', async ({ page }) => {
  await setup(page);
  // Auto parallel zur Wand stellen: Fahrerseite (links) zur Wand
  const res = await page.evaluate(async (wall) => {
    const w = (window as any).__kc.getWorld();
    const wallYaw = wall.heading; // Blickrichtung zur Wand
    const carHeading = wallYaw + Math.PI / 2; // Wand liegt links vom Auto
    const dist = 28.8; // Auto-Mitte ca. 1,2 m vor der Wand
    const x = wall.x + Math.sin(wallYaw) * dist,
      z = wall.z + Math.cos(wallYaw) * dist;
    const v = (window as any).__kcSpawn(0, 0, { x, z, heading: carHeading });
    await new Promise((r) => setTimeout(r, 1500));
    // in den Fahrzeugmanager-Ablauf einsteigen: direkt über den Controller
    const veh = {
      sim: v,
      position: v.position,
      wrecked: false,
      speed: 0,
      id: -1,
      kind: 0,
      moved: true,
      awake: true,
      health: 1,
    };
    Object.defineProperty(veh, 'speed', { get: () => v.velocity.length() });
    w.player.enter(veh);
    await new Promise((r) => setTimeout(r, 300));
    w.player.leaveVehicle(true);
    await new Promise((r) => setTimeout(r, 300));
    const p = w.player.walker.position;
    const right = { x: Math.cos(carHeading), z: -Math.sin(carHeading) };
    const side = (p.x - v.position.x) * right.x + (p.z - v.position.z) * right.z;
    return { side, y: p.y, ground: w.tiles.heightAt(p.x, p.z) };
  }, WALL);
  console.log(JSON.stringify(res));
  expect(res.side).toBeGreaterThan(0.5); // rechts ausgestiegen, nicht in der Wand
  expect(Math.abs(res.y - res.ground)).toBeLessThan(0.6);
});

test('Fahrkamera schwenkt nach einem Wisch innerhalb von 2 s hinter das Fahrzeug zurück', async ({ page }) => {
  await setup(page);
  await nextToCar(page);
  await waitPlayable(page);
  await page.evaluate(() => {
    (window as any).__kc.input.action = true;
  });
  await page.waitForFunction(() => (window as any).__kc.getWorld().player.state.kind === 'driving');
  const err = await page.evaluate(async () => {
    const kc = (window as any).__kc;
    const cam = kc.getGame().camera;
    const w = kc.getWorld();
    kc.input.lookDX = 1.4; // kräftiger Wisch zur Seite
    await new Promise((r) => setTimeout(r, 2200));
    const h = w.player.heading;
    const behind = Math.atan2(-Math.cos(h), -Math.sin(h));
    let d = (cam.alpha - behind) % (2 * Math.PI);
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    return Math.abs(d);
  });
  expect(err).toBeLessThan(0.15);
});
