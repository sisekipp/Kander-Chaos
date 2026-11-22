import { expect, test, type Page } from '@playwright/test';
import { firstVisit, waitPlayable } from './helpers.ts';

test.setTimeout(300_000);

async function setup(page: Page) {
  await firstVisit(page);
  await page.getByRole('button', { name: 'Testmodus' }).click();
  await waitPlayable(page);
  await page.waitForFunction(
    () => {
      const w = (window as any).__kc.getWorld();
      return w.tiles.isSettled && w.props.tileCount > 0;
    },
    null,
    { timeout: 60_000, polling: 300 },
  );
}

/** Nächstes Kleinobjekt einer Art zum Startpunkt (kind: 0 Busch, 1 Mülleimer, 2 Zaun, 3 Schild, 4 Laterne, 5 Bank). */
async function findProp(page: Page, kind: number) {
  return page.evaluate((kind) => {
    const w = (window as any).__kc.getWorld();
    const s = w.index.spawn;
    let best: any = null;
    for (const t of w.props.allTiles())
      for (const p of t.props) {
        if (p.kind !== kind || t.rebuild.isDestroyed(p.index)) continue;
        const d = Math.hypot(p.x - s.x, p.z - s.z);
        if (!best || d < best.d) best = { d, x: p.x, z: p.z, y: p.y, index: p.index, tileId: t.tileId };
      }
    return best;
  }, kind);
}

const destroyed = (page: Page, tileId: string, index: number) =>
  page.evaluate(
    ({ tileId, index }) => {
      for (const t of (window as any).__kc.getWorld().props.allTiles())
        if (t.tileId === tileId) return t.rebuild.isDestroyed(index);
      return null;
    },
    { tileId, index },
  );

test('Kleinobjekte: ≥ 3 Arten nahe der Kernstadt, ≤ 8 Draw Calls je Kachel', async ({ page }) => {
  await setup(page);
  const r = await page.evaluate(() => {
    const w = (window as any).__kc.getWorld();
    const s = w.index.spawn;
    const id = `${Math.floor(s.x / 250)},${Math.floor(s.z / 250)}`;
    const meshes = w.tiles.tileAt(s.x, s.z).meshes.filter((m: any) => m.name.startsWith('props'));
    const kinds = new Set<number>();
    for (const t of w.props.allTiles())
      for (const p of t.props) if (Math.hypot(p.x - s.x, p.z - s.z) < 300) kinds.add(p.kind);
    return { id, propMeshes: meshes.length, kinds: kinds.size };
  });
  console.log(JSON.stringify(r));
  expect(r.propMeshes).toBeLessThanOrEqual(8);
  expect(r.kinds).toBeGreaterThanOrEqual(3);
});

test('Auto mit 30 km/h gegen Mülleimer: Mülleimer fliegt weg, Auto fährt weiter', async ({ page }) => {
  await setup(page);
  const bin = await findProp(page, 1);
  expect(bin).not.toBeNull();
  const r = await page.evaluate(async (bin) => {
    const kc = (window as any).__kc,
      w = kc.getWorld();
    const h = 0.3; // Anfahrt aus fester Richtung
    // echtes Fahrzeug aus dem Fahrzeug-Manager (nur diese sind Akteure für Kleinobjekte)
    const p0 = w.player.position;
    const car = [...w.vehicles.all()]
      .filter((c: any) => c.kind === 0)
      .sort(
        (a: any, b: any) =>
          Math.hypot(a.position.x - p0.x, a.position.z - p0.z) - Math.hypot(b.position.x - p0.x, b.position.z - p0.z),
      )[0];
    w.player.enter(car);
    await new Promise((r) => setTimeout(r, 300));
    const V = car.sim.position.constructor;
    const sx = bin.x - Math.sin(h) * 14,
      sz = bin.z - Math.cos(h) * 14;
    car.sim.teleport(new V(sx, (w.tiles.heightAt(sx, sz) ?? bin.y) + 0.8, sz), h);
    await new Promise((r) => setTimeout(r, 1200));
    const v = car.sim;
    const before = w.props.triggered;
    const propsBefore = w.budget.countOf('prop');
    let maxKmh = 0,
      kmhAtEnd = 0;
    for (let i = 0; i < 25; i++) {
      kc.input.gas = true;
      await new Promise((r) => setTimeout(r, 100));
      maxKmh = Math.max(maxKmh, v.forwardSpeed * 3.6);
    }
    kmhAtEnd = v.forwardSpeed * 3.6;
    kc.input.gas = false;
    return { triggered: w.props.triggered - before, flying: w.budget.countOf('prop') - propsBefore, maxKmh, kmhAtEnd };
  }, bin);
  console.log(JSON.stringify(r));
  expect(await destroyed(page, bin.tileId, bin.index)).toBe(true);
  expect(r.flying).toBeGreaterThanOrEqual(1);
  expect(r.kmhAtEnd).toBeGreaterThan(15);
});

test('Fahrrad mit 20 km/h durch einen Busch: zerfällt in Teile, Rad wird nur leicht abgebremst', async ({ page }) => {
  await setup(page);
  const bush = await findProp(page, 0);
  const r = await page.evaluate(async (b) => {
    const w = (window as any).__kc.getWorld();
    const before = w.budget.countOf('debris');
    // Treffer direkt auslösen wie die Trefferprüfung es bei 20 km/h täte
    const actor = {
      x: b.x,
      z: b.z,
      vx: 0,
      vz: 20 / 3.6,
      radius: 0.4,
      slowed: 0,
      onHit(_k: number, _kmh: number, s: number) {
        this.slowed = s;
      },
    };
    w.props.update([actor], b.x, b.z, false);
    await new Promise((r) => setTimeout(r, 300));
    return { debris: w.budget.countOf('debris') - before, slowed: actor.slowed };
  }, bush);
  console.log(JSON.stringify(r));
  expect(r.debris).toBeGreaterThanOrEqual(3);
  expect(r.slowed).toBeLessThan(0.1);
});

test('zu Fuß gegen eine Laterne: sie bleibt stehen und hält die Figur auf', async ({ page }) => {
  await setup(page);
  const lamp = await findProp(page, 4);
  expect(lamp).not.toBeNull();
  const r = await page.evaluate(async (l) => {
    const kc = (window as any).__kc,
      w = kc.getWorld();
    // 4 m südlich der Laterne, Blick nach Norden
    w.player.teleport(l.x, l.z - 4);
    for (let i = 0; i < 40 && w.player.isFrozen; i++) await new Promise((r) => setTimeout(r, 200));
    await new Promise((r) => setTimeout(r, 600));
    kc.getGame().camera.alpha = -Math.PI / 2; // Kamera blickt nach Norden
    kc.input.moveY = 1;
    let minD = 99;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const p = w.player.walker.position;
      minD = Math.min(minD, Math.hypot(p.x - l.x, p.z - l.z));
    }
    kc.input.moveY = 0;
    return { minD, colliders: w.props.colliders.count };
  }, lamp);
  console.log(JSON.stringify(r));
  expect(await destroyed(page, lamp.tileId, lamp.index)).toBe(false);
  expect(r.colliders).toBeGreaterThan(0);
  expect(r.minD).toBeGreaterThan(0.25);
});

test('zerstörter Zaun steht nach Entladen und Neuladen der Kachel wieder', async ({ page }) => {
  await setup(page);
  const fence = await findProp(page, 2);
  await page.evaluate((f) => {
    const w = (window as any).__kc.getWorld();
    for (const t of w.props.allTiles()) if (t.tileId === f.tileId) w.props.trigger(t, f.index, 5, 0);
  }, fence);
  expect(await destroyed(page, fence.tileId, fence.index)).toBe(true);
  const settle = () =>
    page.waitForFunction(
      () => {
        const w = (window as any).__kc.getWorld();
        return w.tiles.isSettled && !w.player.isFrozen;
      },
      null,
      { timeout: 90_000, polling: 400 },
    );
  await page.evaluate(() => {
    const w = (window as any).__kc.getWorld();
    w.player.teleport(w.index.spawn.x + 2500, w.index.spawn.z + 1500);
  });
  await settle();
  await page.evaluate((f) => (window as any).__kc.getWorld().player.teleport(f.x + 3, f.z + 3), fence);
  await settle();
  expect(await destroyed(page, fence.tileId, fence.index)).toBe(false);
});
