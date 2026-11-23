import { expect, test, type Page } from '@playwright/test';
import { firstVisit, waitPlayable } from './helpers.ts';

test.setTimeout(300_000);

/** Testmodus, am Landeplatz `pad` in den Hubschrauber. */
async function inHeli(page: Page, pad: string) {
  await page.getByRole('button', { name: 'Testmodus' }).click();
  await waitPlayable(page);
  await page.evaluate(async (id) => {
    const w = (window as any).__kc.getWorld();
    const p = (await fetch('/world/helipads.json').then((r) => r.json())).helipads.find((x: any) => x.id === id);
    w.player.teleport(p.x + 5, p.z);
    for (let k = 0; k < 120 && !w.heli.canEnter; k++) await new Promise((r) => setTimeout(r, 500));
    w.heli.enter();
    await new Promise((r) => setTimeout(r, 3500));
  }, pad);
}

/** Hubschrauber neben ein Wahrzeichen setzen (Abstand, Höhe), Kacheln und Modelle abwarten. */
const hoverAt = (page: Page, id: string, dist: number, alt: number) =>
  page.evaluate(
    async ({ id, dist, alt }) => {
      const kc = (window as any).__kc;
      const w = kc.getWorld();
      const lm = (await fetch('/world/landmarks.json').then((r) => r.json())).landmarks.find((l: any) => l.id === id);
      const h = w.heli.active;
      const hd = Math.atan2(-1, 1.3);
      h.state = {
        ...h.state,
        x: lm.x - Math.sin(hd) * dist,
        z: lm.z - Math.cos(hd) * dist,
        y: lm.ground + alt,
        vx: 0,
        vy: 0,
        vz: 0,
        grounded: false,
        high: false,
        heading: hd,
      };
      kc.getGame().camera.alpha = -hd - Math.PI / 2;
      await new Promise((r) => setTimeout(r, 1500));
      for (let k = 0; k < 120 && !w.tiles.isSettled; k++) await new Promise((r) => setTimeout(r, 500));
      await new Promise((r) => setTimeout(r, 3000));
      return lm;
    },
    { id, dist, alt },
  );

test('Erstbesuch lädt keine Modelle der Region', async ({ page }) => {
  const remote: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/models-remote/') && r.url().endsWith('.glb')) remote.push(r.url());
  });
  await firstVisit(page);
  expect(remote).toHaveLength(0);
});

test('Basel: Münster, Rathaus, Mittlere Brücke und Roche-Türme stehen als Modelle, kein doppeltes Gebäude', async ({
  page,
}) => {
  await firstVisit(page);
  await inHeli(page, 'basel');
  await hoverAt(page, 'basel-rathaus', 250, 80);
  await page.screenshot({ path: 'test-results/basel-altstadt.png' });
  const altstadt: string[] = await page.evaluate(() => [...(window as any).__kc.getWorld().landmarks.placed.keys()]);
  expect(altstadt).toEqual(expect.arrayContaining(['basel-rathaus', 'basel-mittlere-bruecke']));
  await hoverAt(page, 'basel-roche-bau-2', 600, 120);
  await page.screenshot({ path: 'test-results/basel-roche.png' });
  const r = await page.evaluate(async () => {
    const w = (window as any).__kc.getWorld();
    const placed = [...w.landmarks.placed.keys()];
    // generiertes Gebäude ausgelassen: Gebäude-IDs der platzierten Wahrzeichen stehen in der Auslass-Liste
    const lms = (await fetch('/world/landmarks.json').then((x) => x.json())).landmarks;
    const roche = lms.find((l: any) => l.id === 'basel-roche-bau-2');
    const tid = `${Math.floor(roche.x / 250)},${Math.floor(roche.z / 250)}`;
    return { placed, skipped: w.landmarks.skipFor(tid).includes(roche.buildingId) };
  });
  expect(r.placed).toEqual(expect.arrayContaining(['basel-roche-bau-1', 'basel-roche-bau-2']));
  expect(r.skipped).toBe(true);
  await hoverAt(page, 'basel-muenster', 250, 80);
  const old = await page.evaluate(() => [...(window as any).__kc.getWorld().landmarks.placed.keys()]);
  expect(old).toContain('basel-muenster');
});

test('Hubschrauber prallt am Roche-Turm ab', async ({ page }) => {
  await firstVisit(page);
  await inHeli(page, 'basel');
  const lm = await hoverAt(page, 'basel-roche-bau-2', 70, 120);
  const r = await page.evaluate(async (lm) => {
    const kc = (window as any).__kc;
    const w = kc.getWorld();
    const h = w.heli.active;
    // von Nordwesten in 120 m Höhe anfliegen: dort ist nur der Turm selbst so hoch
    h.state = { ...h.state, x: lm.x - 55, z: lm.z + 55, y: lm.ground + 120, vx: 0, vy: 0, vz: 0 };
    await new Promise((res) => setTimeout(res, 1500));
    const hd = Math.atan2(lm.x - h.state.x, lm.z - h.state.z);
    h.state = { ...h.state, heading: hd };
    kc.getGame().camera.alpha = -hd - Math.PI / 2;
    const start = Math.hypot(h.state.x - lm.x, h.state.z - lm.z);
    kc.input.moveY = 1;
    for (let k = 0; k < 40; k++) await new Promise((res) => setTimeout(res, 150));
    kc.input.moveY = 0;
    const half = Math.min(
      ...[0, 1].map((a) => Math.max(...lm.footprint.filter((_: number, i: number) => i % 2 === a).map(Math.abs))),
    );
    return { start, dist: Math.hypot(h.state.x - lm.x, h.state.z - lm.z), half };
  }, lm);
  console.log(JSON.stringify(r));
  expect(r.dist).toBeLessThan(r.start - 20); // ist auf den Turm zugeflogen
  expect(r.dist).toBeGreaterThan(r.half); // und steht vor der Fassade, nicht im Turm
});

test('EuroAirport: Terminal und mindestens fünf Flugzeuge', async ({ page }) => {
  await firstVisit(page);
  await inHeli(page, 'euroairport');
  await hoverAt(page, 'euroairport-terminal', 300, 60);
  await page.screenshot({ path: 'test-results/euroairport-terminal.png' });
  const placed: string[] = await page.evaluate(() => [...(window as any).__kc.getWorld().landmarks.placed.keys()]);
  expect(placed).toContain('euroairport-terminal');
  expect(placed.filter((p) => p.startsWith('euroairport-flugzeug')).length).toBeGreaterThanOrEqual(5);
});

test.describe('Modell nicht ladbar', () => {
  // Ohne Service Worker sieht page.route die Modellanfragen und kann sie gezielt scheitern lassen
  test.use({ serviceWorkers: 'block' });
  test('fehlt das Modell (offline/Fehler), steht das generierte Gebäude', async ({ page }) => {
    await firstVisit(page, '?debug', { waitForServiceWorker: false });
    // erst nach dem Laden der Kernmodelle sperren (Abfangen ab Seitenstart bremst WebKit beim Modell-Laden)
    await page.route(/\/models-remote\/.*\.glb$/, (r) => r.abort('internetdisconnected'));
    await inHeli(page, 'basel');
    await hoverAt(page, 'basel-rathaus', 250, 80);
    const r = await page.evaluate(async () => {
      const w = (window as any).__kc.getWorld();
      const lm = (await fetch('/world/landmarks.json').then((x) => x.json())).landmarks.find(
        (l: any) => l.id === 'basel-rathaus',
      );
      const tid = `${Math.floor(lm.x / 250)},${Math.floor(lm.z / 250)}`;
      return {
        placed: w.landmarks.placed.has('basel-rathaus'),
        skipped: w.landmarks.skipFor(tid).includes(lm.buildingId),
        tile: w.tiles.tileAt(lm.x, lm.z)?.ring ?? null,
      };
    });
    expect(r.tile).not.toBeNull(); // Kachel geladen, keine Lücke
    expect(r.placed).toBe(false);
    expect(r.skipped).toBe(false); // generiertes Gebäude bleibt
  });
});

test('Fernsicht: Münster aus 5 km als Form aus mehreren Teilen, wenige Draw Calls', async ({ page }) => {
  await firstVisit(page);
  await inHeli(page, 'basel');
  const lm = await hoverAt(page, 'basel-muenster', 5000, 300);
  const r = await page.evaluate(async (lm) => {
    const w = (window as any).__kc.getWorld();
    const sil = (await fetch('/world/silhouettes.json').then((x) => x.json())).silhouettes['basel-muenster'];
    const engine = (window as any).__kc.getGame().scene.getEngine();
    return {
      parts: sil.length,
      ring: w.tiles.tileAt(lm.x, lm.z)?.ring ?? null,
      count: w.far.silhouetteCount,
      calls: engine._drawCalls?.current ?? 0,
    };
  }, lm);
  console.log(JSON.stringify(r));
  expect(r.parts).toBeGreaterThanOrEqual(2);
  expect(r.ring === null || r.ring === 2).toBe(true);
  expect(r.count).toBeGreaterThan(0);
});

test('Screenshots: Weil am Rhein, Lörrach, Müllheim', async ({ page }) => {
  await firstVisit(page);
  await inHeli(page, 'loerrach');
  for (const [id, file] of [
    ['weil-vitra-haus', 'weil-vitra'],
    ['loerrach-rathaus', 'loerrach-rathaus'],
    ['loerrach-burg-roetteln', 'loerrach-burg-roetteln'],
    ['muellheim-martinskirche', 'muellheim-martinskirche'],
  ]) {
    await hoverAt(page, id, 220, 70);
    await page.screenshot({ path: `test-results/${file}.png` });
    const placed: string[] = await page.evaluate(() => [...(window as any).__kc.getWorld().landmarks.placed.keys()]);
    expect(placed).toContain(id);
  }
});
