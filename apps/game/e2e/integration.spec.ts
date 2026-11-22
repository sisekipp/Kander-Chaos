import { expect, test } from '@playwright/test';
import { firstVisit, trackForeignRequests, waitPlayable } from './helpers.ts';

test.setTimeout(300_000);

test('offline: Einsteigen, Fahren, Kleinobjekt umfahren, Aussteigen – ohne fremde Hosts', async ({
  page,
  context,
  baseURL,
}) => {
  const foreign = trackForeignRequests(page, baseURL!);
  await firstVisit(page);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Testmodus' }).click();
  await waitPlayable(page);
  await page.waitForFunction(
    () => {
      const w = (window as any).__kc.getWorld();
      return w.tiles.isSettled && w.vehicles.count > 0 && w.props.tileCount > 0;
    },
    null,
    { timeout: 90_000, polling: 300 },
  );
  // Ziel: nächster Busch; Auto 14 m davor
  const r = await page.evaluate(async () => {
    const kc = (window as any).__kc,
      w = kc.getWorld();
    const s = w.index.spawn;
    let bush: any = null;
    for (const t of w.props.allTiles())
      for (const p of t.props)
        if (p.kind === 0 && (!bush || Math.hypot(p.x - s.x, p.z - s.z) < Math.hypot(bush.x - s.x, bush.z - s.z)))
          bush = { ...p, tileId: t.tileId };
    const car = [...w.vehicles.all()]
      .filter((c: any) => c.kind === 0)
      .sort(
        (a: any, b: any) =>
          Math.hypot(a.position.x - s.x, a.position.z - s.z) - Math.hypot(b.position.x - s.x, b.position.z - s.z),
      )[0];
    // zu Fuß neben das Auto und per Aktionsknopf einsteigen
    const h = car.sim.heading;
    w.player.teleport(car.position.x - Math.cos(h) * 2, car.position.z + Math.sin(h) * 2);
    for (let i = 0; i < 40 && w.player.isFrozen; i++) await new Promise((r) => setTimeout(r, 200));
    await new Promise((r) => setTimeout(r, 600));
    return { bush, canEnter: w.player.canEnter };
  });
  expect(r.canEnter).toBe(true);
  await page.getByRole('button', { name: 'Einsteigen' }).dispatchEvent('pointerdown');
  await page.waitForFunction(() => (window as any).__kc.getWorld().player.state.kind === 'driving');
  const hit = await page.evaluate(async (bush) => {
    const kc = (window as any).__kc,
      w = kc.getWorld();
    const car = w.player.vehicle;
    const V = car.sim.position.constructor;
    const engine = kc.getGame().scene.getPhysicsEngine();
    // Busch mit freier, ebener Anfahrt suchen (kein Gebäude/Fahrzeug auf 16 m)
    const cands: any[] = [];
    for (const t of w.props.allTiles()) for (const p of t.props) if (p.kind === 0) cands.push(p);
    cands.sort((a, b) => Math.hypot(a.x - bush.x, a.z - bush.z) - Math.hypot(b.x - bush.x, b.z - bush.z));
    let pick: any = null;
    for (const c of cands.slice(0, 200)) {
      for (let k = 0; k < 8 && !pick; k++) {
        const ang = (k / 8) * Math.PI * 2;
        const sx = c.x - Math.sin(ang) * 16,
          sz = c.z - Math.cos(ang) * 16;
        const gy = w.tiles.heightAt(sx, sz);
        if (gy === null || Math.abs(gy - c.y) > 1.5) continue;
        const res = engine.raycast(new V(sx, gy + 0.8, sz), new V(c.x, c.y + 0.8, c.z), { ignoreBody: car.sim.body });
        if (!res.hasHit) pick = { c, ang, sx, sz, gy };
      }
      if (pick) break;
    }
    if (!pick) return { triggered: -1, health: car.health };
    const ang = pick.ang,
      sx = pick.sx,
      sz = pick.sz;
    car.sim.teleport(new V(sx, pick.gy + 0.8, sz), ang);
    await new Promise((r) => setTimeout(r, 1200));
    const before = w.props.triggered;
    const h0 = car.health;
    for (let i = 0; i < 40 && w.props.triggered === before; i++) {
      kc.input.gas = true;
      await new Promise((r) => setTimeout(r, 100));
    }
    kc.input.gas = false;
    await new Promise((r) => setTimeout(r, 150));
    return { triggered: w.props.triggered - before, health: car.health, lost: h0 - car.health };
  }, r.bush);
  console.log(JSON.stringify(hit));
  expect(hit.triggered).toBeGreaterThanOrEqual(1);
  expect(hit.lost).toBeLessThanOrEqual(0.02 + 1e-9); // Kleinobjekte kosten höchstens 2 %
  await page.getByRole('button', { name: 'Aussteigen' }).dispatchEvent('pointerdown');
  await page.waitForFunction(() => (window as any).__kc.getWorld().player.state.kind === 'walking', null, {
    timeout: 15_000,
  });
  expect(foreign).toEqual([]);
});

test('Chaos-Test (Desktop): 30 s Zerstörung am Blumenplatz – nie mehr als 80 dynamische Körper und 60 Trümmer', async ({
  page,
}) => {
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
  const r = await page.evaluate(async () => {
    const w = (window as any).__kc.getWorld();
    const s = w.index.spawn;
    const near: { t: any; p: any }[] = [];
    for (const t of w.props.allTiles())
      for (const p of t.props) if (Math.hypot(p.x - s.x, p.z - s.z) < 250) near.push({ t, p });
    let maxBodies = 0,
      maxDebris = 0,
      n = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < 30_000) {
      // jede 100 ms drei Objekte auslösen (deutlich mehr, als ein Kind schafft)
      for (let k = 0; k < 3 && n < near.length; k++, n++) {
        const { t, p } = near[n];
        if (!t.rebuild.isDestroyed(p.index))
          w.props.trigger(t, p.index, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20);
      }
      await new Promise((r) => setTimeout(r, 100));
      maxBodies = Math.max(maxBodies, w.budget.count);
      maxDebris = Math.max(maxDebris, w.budget.countOf('debris'));
    }
    return { triggered: n, maxBodies, maxDebris, fps: (window as any).__kc.getGame().engine.getFps() };
  });
  console.log(JSON.stringify(r));
  expect(r.triggered).toBeGreaterThan(100);
  expect(r.maxBodies).toBeLessThanOrEqual(80);
  expect(r.maxDebris).toBeLessThanOrEqual(60);
});
