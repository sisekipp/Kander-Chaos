import { expect, test, type Page } from '@playwright/test';
import { firstVisit, waitPlayable } from './helpers.ts';

test.setTimeout(240_000);

async function setup(page: Page, x: number, z: number) {
  await firstVisit(page);
  await page.getByRole('button', { name: 'Testmodus' }).click();
  await waitPlayable(page);
  await page.evaluate(({ x, z }) => (window as any).__kc.getWorld().player.teleport(x, z), { x, z });
  await page.waitForFunction(
    () => {
      const w = (window as any).__kc.getWorld();
      return w.tiles.isSettled && !w.player.isFrozen;
    },
    null,
    { timeout: 90_000, polling: 300 },
  );
}

const info = (page: Page, id: string) =>
  page.evaluate(async (id) => {
    const w = (window as any).__kc.getWorld();
    const lm = await fetch('/world/landmarks.json')
      .then((r) => r.json())
      .then((j) => j.landmarks.find((l: any) => l.id === id));
    const root = w.landmarks.placed.get(id);
    if (!root) return { lm, placed: false };
    const meshes = root.getChildMeshes(false).filter((m: any) => m.getTotalVertices() > 0);
    let min = [Infinity, Infinity, Infinity],
      max = [-Infinity, -Infinity, -Infinity];
    for (const m of meshes) {
      m.computeWorldMatrix(true);
      const b = m.getBoundingInfo().boundingBox;
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], b.minimumWorld.asArray()[k]);
        max[k] = Math.max(max[k], b.maximumWorld.asArray()[k]);
      }
    }
    return {
      lm,
      placed: true,
      center: [(min[0] + max[0]) / 2, (min[2] + max[2]) / 2],
      height: max[1] - min[1],
      ground: w.tiles.heightAt(lm.x, lm.z),
      bottom: min[1],
      alpha: meshes.some((m: any) => m.hasVertexAlpha),
    };
  }, id);

test('Wahrzeichen in Kandern stehen auf ihrem Grundriss (Stadtkirche, Rathaus, Museum)', async ({ page }) => {
  await setup(page, -85, 110);
  for (const id of ['kandern-stadtkirche', 'kandern-rathaus', 'kandern-museum']) {
    const r = await info(page, id);
    console.log(id, JSON.stringify({ ...r, lm: undefined }));
    expect(r.placed).toBe(true);
    // Modellmitte liegt nahe der Grundrissmitte, Modell steht auf dem Gelände und ist undurchsichtig
    expect(Math.hypot(r.center![0] - r.lm.x, r.center![1] - r.lm.z)).toBeLessThan(6);
    expect(r.bottom!).toBeLessThan(r.ground!);
    expect(r.height!).toBeGreaterThan(6);
    expect(r.alpha).toBe(false);
  }
  const church = await info(page, 'kandern-stadtkirche');
  expect(church.height!).toBeGreaterThan(25); // mit Turm
});

test('Wahrzeichen ersetzen das generierte Gebäude und halten die Figur auf', async ({ page }) => {
  await setup(page, -85, 110);
  const r = await page.evaluate(async () => {
    const w = (window as any).__kc.getWorld();
    const lm = (await fetch('/world/landmarks.json').then((x) => x.json())).landmarks.find(
      (l: any) => l.id === 'kandern-stadtkirche',
    );
    // Figur 14 m vor der Kirche quer zur Längsachse auf die Wand zulaufen lassen
    const vx = -lm.uz,
      vz = lm.ux;
    w.player.teleport(lm.x + vx * 14, lm.z + vz * 14);
    await new Promise((res) => setTimeout(res, 1500));
    const heading = Math.atan2(-vx, -vz);
    const kc = (window as any).__kc;
    kc.getGame().camera.alpha = -heading - Math.PI / 2;
    kc.input.moveY = 1;
    await new Promise((res) => setTimeout(res, 5000));
    kc.input.moveY = 0;
    const p = w.player.position;
    const dist = (p.x - lm.x) * vx + (p.z - lm.z) * vz;
    const halfWidth = Math.max(...lm.footprint.filter((_: number, i: number) => i % 2 === 1));
    const tileId = `${Math.floor(lm.x / w.index.tileSize)},${Math.floor(lm.z / w.index.tileSize)}`;
    return { dist, halfWidth, skipped: w.tiles.o.skipBuildings(tileId).includes(lm.buildingId) };
  });
  console.log(JSON.stringify(r));
  expect(r.skipped).toBe(true);
  expect(r.dist).toBeGreaterThan(r.halfWidth - 0.5); // nicht durch die Wand
});

test('Wahrzeichen sind auch im Flug in 200 m Höhe sichtbar (Ring 1), ohne Kollision dort', async ({ page }) => {
  await setup(page, -85, 110);
  await page.getByRole('button', { name: 'Fliegen' }).dispatchEvent('pointerdown');
  await page.waitForFunction(() => (window as any).__kc.getWorld().flying);
  await page.evaluate(() => {
    const w = (window as any).__kc.getWorld();
    const c = w.fly.controllerState;
    c.state = { ...c.state, x: -85, z: 60, y: (w.tiles.heightAt(-85, 60) ?? c.ground) + 200, vx: 0, vy: 0, vz: 0 };
  });
  await page.waitForTimeout(500);
  await page.waitForFunction(
    () => {
      const w = (window as any).__kc.getWorld();
      return w.tiles.isSettled && ![...w.tiles.tiles].some((t: any) => t.ring === 0);
    },
    null,
    { timeout: 90_000, polling: 300 },
  );
  const r = await page.evaluate(() => {
    const w = (window as any).__kc.getWorld();
    const root = w.landmarks.placed.get('kandern-stadtkirche');
    const ids = [...w.landmarks.placed.keys()];
    const visible = root && root.getChildMeshes(false).some((m: any) => m.isEnabled() && m.isVisible);
    return { count: ids.length, church: !!root, visible };
  });
  console.log(JSON.stringify(r));
  expect(r.church).toBe(true);
  expect(r.visible).toBe(true);
  expect(r.count).toBeGreaterThanOrEqual(15);
});
