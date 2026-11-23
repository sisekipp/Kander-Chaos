import { expect, test, type Page } from '@playwright/test';
import { firstVisit, waitPlayable } from './helpers.ts';

test.setTimeout(240_000);

/** Testmodus starten, neben den Landeplatz Kandern stellen und einsteigen. */
async function boarded(page: Page) {
  await firstVisit(page);
  await page.getByRole('button', { name: 'Testmodus' }).click();
  await waitPlayable(page);
  const pad = await page.evaluate(async () =>
    (await fetch('/world/helipads.json').then((r) => r.json())).helipads.find((p: any) => p.id === 'kandern'),
  );
  await page.evaluate(({ x, z }) => (window as any).__kc.getWorld().player.teleport(x + 5, z), pad);
  await page.waitForFunction(
    () => {
      const w = (window as any).__kc.getWorld();
      return w.tiles.isSettled && !w.player.isFrozen && w.heli.canEnter;
    },
    null,
    { timeout: 90_000, polling: 300 },
  );
  await expect(page.getByRole('button', { name: 'Einsteigen' })).toBeVisible();
  await page.getByRole('button', { name: 'Einsteigen' }).dispatchEvent('pointerdown');
  await page.waitForFunction(() => (window as any).__kc.getWorld().heli.flying);
  return pad;
}

const state = (page: Page) =>
  page.evaluate(() => {
    const w = (window as any).__kc.getWorld();
    const s = w.heli.active.state;
    return { ...s, alt: s.y - (w.tiles.heightAt(s.x, s.z) ?? s.y), speed: Math.hypot(s.vx, s.vz) };
  });

const hold = (page: Page, fields: Record<string, number | boolean>, ms: number) =>
  page.evaluate(
    async ({ fields, ms }) => {
      const i = (window as any).__kc.input;
      Object.assign(i, fields);
      await new Promise((r) => setTimeout(r, ms));
      for (const k of Object.keys(fields)) i[k] = typeof fields[k] === 'boolean' ? false : 0;
    },
    { fields, ms },
  );

/** Hubschrauber direkt in eine Höhe über Gelände setzen (Testabkürzung). */
const placeAt = (page: Page, alt: number) =>
  page.evaluate((alt) => {
    const w = (window as any).__kc.getWorld();
    const h = w.heli.active;
    const g = w.tiles.heightAt(h.state.x, h.state.z) ?? h.state.y;
    h.state = { ...h.state, y: g + alt, vx: 0, vy: 0, vz: 0, grounded: false, high: alt > 120 };
  }, alt);

test('Hubschrauber: Einsteigen am Landeplatz, Rotoren laufen an, Steigen, Loslassen -> Schweben', async ({ page }) => {
  await boarded(page);
  await expect(page.getByRole('button', { name: 'Hoch', exact: true })).toBeVisible();
  await page.waitForTimeout(3200);
  expect((await state(page)).rotor).toBeGreaterThan(0.9);
  await hold(page, { flyUp: true }, 3000);
  const up = await state(page);
  expect(up.alt).toBeGreaterThan(10);
  // in der Luft kein Aussteigen
  await page.waitForTimeout(400);
  await expect(page.getByRole('button', { name: 'Aussteigen' })).toHaveCount(0);
  await hold(page, { moveY: 1 }, 3000);
  expect((await state(page)).speed).toBeGreaterThan(10);
  await page.waitForTimeout(2000);
  const hover = await state(page);
  console.log(JSON.stringify({ alt: up.alt, hoverSpeed: hover.speed }));
  expect(hover.speed).toBeLessThan(1);
});

test('Hubschrauber: Tempo nach Höhe (tief ≤ 30 m/s, hoch bis 60 m/s), unter ihm immer Gelände', async ({ page }) => {
  await boarded(page);
  await page.waitForTimeout(3200);
  await placeAt(page, 50);
  // Höchstwert während des Haltens messen (nach dem Loslassen bremst er sofort ab)
  const low = await page.evaluate(async () => {
    const kc = (window as any).__kc;
    kc.input.moveY = 1;
    kc.input.fast = true;
    let speed = 0;
    for (let k = 0; k < 30; k++) {
      await new Promise((res) => setTimeout(res, 150));
      const s = kc.getWorld().heli.active.state;
      speed = Math.max(speed, Math.hypot(s.vx, s.vz));
    }
    kc.input.moveY = 0;
    kc.input.fast = false;
    return { speed };
  });
  await placeAt(page, 300);
  const r = await page.evaluate(async () => {
    const kc = (window as any).__kc;
    const w = kc.getWorld();
    kc.input.moveY = 1;
    kc.input.fast = true;
    let holes = 0,
      max = 0;
    for (let k = 0; k < 40; k++) {
      await new Promise((res) => setTimeout(res, 150));
      const s = w.heli.active.state;
      max = Math.max(max, Math.hypot(s.vx, s.vz));
      if (!w.tiles.tileAt(s.x, s.z)) holes++;
    }
    kc.input.moveY = 0;
    kc.input.fast = false;
    return { holes, max };
  });
  console.log(JSON.stringify({ low: low.speed, high: r.max, holes: r.holes }));
  expect(low.speed).toBeGreaterThan(25);
  expect(low.speed).toBeLessThanOrEqual(30.01);
  expect(r.max).toBeGreaterThan(35);
  expect(r.max).toBeLessThanOrEqual(60.01);
  expect(r.holes).toBe(0);
});

test('Hubschrauber: Landung auf dem Blumenplatz und Aussteigen neben dem Hubschrauber', async ({ page }) => {
  await boarded(page);
  await page.waitForTimeout(3200);
  await page.evaluate(() => {
    const w = (window as any).__kc.getWorld();
    const s = w.index.spawn;
    const h = w.heli.active;
    h.state = {
      ...h.state,
      x: s.x,
      z: s.z,
      y: (w.tiles.heightAt(s.x, s.z) ?? h.state.y) + 25,
      vx: 0,
      vy: 0,
      vz: 0,
      grounded: false,
    };
  });
  await page.waitForFunction(
    () =>
      (window as any).__kc
        .getWorld()
        .tiles.isCollisionReady(
          (window as any).__kc.getWorld().heli.active.state.x,
          (window as any).__kc.getWorld().heli.active.state.z,
        ),
    null,
    { timeout: 60_000 },
  );
  await page.evaluate(() => ((window as any).__kc.input.flyDown = true));
  await page.waitForFunction(() => (window as any).__kc.getWorld().heli.active.state.grounded, null, {
    timeout: 30_000,
  });
  await page.evaluate(() => ((window as any).__kc.input.flyDown = false));
  await expect(page.getByRole('button', { name: 'Aussteigen' })).toBeVisible();
  await page.getByRole('button', { name: 'Aussteigen' }).dispatchEvent('pointerdown');
  await expect(page.getByRole('button', { name: 'Springen' })).toBeVisible();
  const r = await page.evaluate(() => {
    const w = (window as any).__kc.getWorld();
    const h = w.heli.all.find((x: any) => x.moved);
    const p = w.player.position;
    return {
      dist: Math.hypot(p.x - h.state.x, p.z - h.state.z),
      heliStore: (window as any).__kc.store.getState().heli,
    };
  });
  expect(r.heliStore).toBe(false);
  expect(r.dist).toBeLessThan(5);
});

test('Hubschrauber: prallt an einem Gebäude ab, bleibt aufrecht und fliegt nicht hindurch', async ({ page }) => {
  await boarded(page);
  await page.waitForTimeout(3200);
  const r = await page.evaluate(async () => {
    const kc = (window as any).__kc;
    const w = kc.getWorld();
    const lm = (await fetch('/world/landmarks.json').then((x) => x.json())).landmarks.find(
      (l: any) => l.id === 'kandern-stadtkirche',
    );
    const vx = -lm.uz,
      vz = lm.ux; // quer zur Kirche
    const h = w.heli.active;
    const g = w.tiles.heightAt(lm.x + vx * 40, lm.z + vz * 40) ?? h.state.y;
    // Bug zur Kirche: die Verfolgerkamera schwenkt hinter den Hubschrauber, vorwärts = Bugrichtung
    h.state = {
      ...h.state,
      x: lm.x + vx * 40,
      z: lm.z + vz * 40,
      y: g + 6,
      vx: 0,
      vy: 0,
      vz: 0,
      grounded: false,
      heading: Math.atan2(-vx, -vz),
    };
    await new Promise((res) => setTimeout(res, 2500)); // Kacheln und Kollision der Kirche laden
    kc.getGame().camera.alpha = -Math.atan2(-vx, -vz) - Math.PI / 2;
    kc.input.moveY = 1;
    kc.input.fast = true;
    let maxTilt = 0;
    for (let k = 0; k < 30; k++) {
      await new Promise((res) => setTimeout(res, 150));
      const s = h.state;
      maxTilt = Math.max(maxTilt, Math.abs(s.pitch), Math.abs(s.roll));
    }
    kc.input.moveY = 0;
    kc.input.fast = false;
    const s = h.state;
    const dist = (s.x - lm.x) * vx + (s.z - lm.z) * vz;
    const half = Math.max(...lm.footprint.filter((_: number, i: number) => i % 2 === 1));
    return { dist, half, maxTilt };
  });
  console.log(JSON.stringify(r));
  expect(r.dist).toBeGreaterThan(r.half);
  expect(r.maxTilt).toBeLessThan(0.5);
});

test('Messroute „Hubschrauber Basel“ läuft durch, unter dem Hubschrauber immer Gelände', async ({ page }) => {
  test.setTimeout(900_000);
  await firstVisit(page);
  await page.getByRole('button', { name: 'Testmodus' }).click();
  await waitPlayable(page);
  await page.getByRole('button', { name: 'Heli Basel' }).click();
  const r = await page.evaluate(async () => {
    const w = (window as any).__kc.getWorld();
    let holes = 0,
      samples = 0,
      started = false;
    const t0 = performance.now();
    // Bildzeiten während des Flugs mitschreiben (Desktop-Messwert für docs/perf)
    const frames: number[] = [];
    let last = performance.now();
    const tick = (now: number) => {
      if (started) frames.push(now - last);
      last = now;
      if (w.routeActive || !started) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    while (performance.now() - t0 < 800_000) {
      await new Promise((res) => setTimeout(res, 500));
      const h = w.heli.active;
      if (h) started = true;
      if (started && !w.routeActive) break;
      if (h && h.state.rotor > 0.9) {
        samples++;
        if (!w.tiles.tileAt(h.state.x, h.state.z)) holes++;
      }
    }
    const s = w.heli.active?.state;
    const sorted = [...frames].sort((a, b) => b - a);
    const avgFps = frames.length / (frames.reduce((a, b) => a + b, 0) / 1000);
    const p1LowFps = 1000 / (sorted[Math.floor(sorted.length * 0.01)] ?? 1000);
    return {
      holes,
      samples,
      done: !w.routeActive,
      x: s?.x,
      z: s?.z,
      secs: (performance.now() - t0) / 1000,
      avgFps,
      p1LowFps,
      maxFrameMs: sorted[0],
    };
  });
  console.log(JSON.stringify(r));
  const pad = await page.evaluate(async () =>
    (await fetch('/world/helipads.json').then((x) => x.json())).helipads.find((p: any) => p.id === 'euroairport'),
  );
  expect(r.done).toBe(true);
  expect(Math.hypot(r.x - pad.x, r.z - pad.z)).toBeLessThan(40);
  expect(r.holes).toBe(0);
});
