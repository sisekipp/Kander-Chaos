import { expect, test, type Page } from '@playwright/test';
import { firstVisit, waitPlayable } from './helpers.ts';

test.setTimeout(240_000);

const WALL = { x: -102.3, z: 128.6, heading: 2.085 }; // freie Hauswand nahe dem Blumenplatz

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

/** Nächstes geparktes Auto nehmen, Spieler einsteigen lassen; optional an eine Stelle versetzen. */
async function takeCar(page: Page, at?: { x: number; z: number; heading: number }) {
  return page.evaluate(async (at) => {
    const w = (window as any).__kc.getWorld();
    const p = w.player.position;
    const car = [...w.vehicles.all()]
      .filter((v: any) => v.kind === 0 && !v.wrecked)
      .sort(
        (a: any, b: any) =>
          Math.hypot(a.position.x - p.x, a.position.z - p.z) - Math.hypot(b.position.x - p.x, b.position.z - p.z),
      )[0];
    w.player.enter(car);
    await new Promise((r) => setTimeout(r, 300));
    if (at) {
      const B = car.sim.position.constructor;
      car.sim.teleport(new B(at.x, (w.tiles.heightAt(at.x, at.z) ?? car.position.y) + 0.8, at.z), at.heading);
      await new Promise((r) => setTimeout(r, 1200));
    }
    (window as any).__car = car;
    return car.id;
  }, at);
}

test('harter Aufprall an einer Hauswand senkt den Zustand deutlich; Balken färbt sich', async ({ page }) => {
  await setup(page);
  await takeCar(page, WALL);
  const res = await page.evaluate(async () => {
    const car = (window as any).__car;
    const input = (window as any).__kc.input;
    input.gas = true; // im Fahrmodus liest der Controller die Pedale aus der Eingabe
    let maxKmh = 0;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 200));
      maxKmh = Math.max(maxKmh, car.sim.forwardSpeed * 3.6);
    }
    input.gas = false;
    return { health: car.health, maxKmh };
  });
  console.log(JSON.stringify(res));
  expect(res.maxKmh).toBeGreaterThan(35);
  expect(res.health).toBeLessThan(0.9);
  await expect(page.getByRole('meter', { name: 'Fahrzeugzustand' })).toHaveAttribute(
    'data-tone',
    res.health < 0.4 ? 'red' : res.health < 0.7 ? 'yellow' : 'green',
  );
});

test('Schadensstufen: Teile fallen ab, Rauch steigt auf, Trümmer verschwinden nach Ruhe', async ({ page }) => {
  await setup(page);
  await takeCar(page);
  const r = await page.evaluate(async () => {
    const kc = (window as any).__kc;
    const w = kc.getWorld();
    const car = (window as any).__car;
    const dmg = w.vehicles.damageOf(car);
    for (let i = 0; i < 3; i++) {
      dmg.applyHit(55, 'world', car.position);
      await new Promise((r) => setTimeout(r, 200));
    }
    await new Promise((r) => setTimeout(r, 400));
    const detached = car.sim.model.detachable.filter((m: any) => !m.isDisposed() && m.parent === null).length;
    return { health: car.health, detached, parts: w.budget.countOf('part'), smokers: w.fx.activeSmokers };
  });
  console.log(JSON.stringify(r));
  expect(r.health).toBeLessThan(0.4);
  expect(r.detached + r.parts).toBeGreaterThanOrEqual(1);
  expect(r.smokers).toBeGreaterThanOrEqual(1);
  await expect(page.getByRole('meter', { name: 'Fahrzeugzustand' })).toHaveAttribute('data-tone', 'red');
  // Teile liegen still -> nach 10 s Ruhe ausgeblendet
  await page.waitForFunction(() => (window as any).__kc.getWorld().budget.countOf('part') === 0, null, {
    timeout: 25_000,
    polling: 500,
  });
});

test('Totalschaden: Puff ohne Feuer, Spieler steigt unverletzt aus, Wrack verschwindet nach 20 s', async ({ page }) => {
  await setup(page);
  const id = await takeCar(page);
  await page.evaluate(async () => {
    const w = (window as any).__kc.getWorld();
    const car = (window as any).__car;
    const dmg = w.vehicles.damageOf(car);
    for (let i = 0; i < 8 && !car.wrecked; i++) {
      dmg.applyHit(80, 'world', car.position);
      await new Promise((r) => setTimeout(r, 200));
    }
  });
  await page.waitForFunction(() => (window as any).__kc.getWorld().player.state.kind === 'walking', null, {
    timeout: 10_000,
  });
  const after = await page.evaluate(() => {
    const w = (window as any).__kc.getWorld();
    const car = (window as any).__car;
    const p = w.player.walker.position;
    return {
      wrecked: car.wrecked,
      visible: w.player.walker.figure.root.isEnabled(),
      onGround: Math.abs(p.y - w.tiles.heightAt(p.x, p.z)) < 1,
      canDrive: !car.sim.wrecked,
    };
  });
  expect(after).toEqual({ wrecked: true, visible: true, onGround: true, canDrive: false });
  // Wrack verschwindet nach 20 s
  await page.waitForFunction((id) => !(window as any).__kc.getWorld().vehicles.get(id), id, {
    timeout: 30_000,
    polling: 500,
  });
});
