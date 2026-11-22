import { expect, test, type Page } from '@playwright/test';
import { firstVisit, trackForeignRequests } from './helpers.ts';

test.setTimeout(240_000);

/** Zustand des Modell-Ladens und die in der Registry vorhandenen Modelle. */
const modelState = (page: Page) =>
  page.evaluate(() => {
    const kc = (window as any).__kc;
    const st = kc.store.getState();
    const reg = kc.getModels();
    return { models: st.models, screen: st.screen, ids: reg?.ids ?? [] };
  });

test('Modelle laden mit Fortschritt und offline aus dem Cache, ohne Anfragen an fremde Hosts', async ({
  page,
  context,
  baseURL,
}) => {
  const foreign = trackForeignRequests(page, baseURL!);
  await firstVisit(page);
  const manifest = await (await page.request.get('/models/manifest.json')).json();
  const online = await modelState(page);
  expect(online.models.ready).toBe(true);
  expect(online.models.loaded).toBe(manifest.models.length);
  expect(online.models.total).toBe(manifest.models.length);
  expect(online.ids.length).toBe(manifest.models.length);

  // Offline neu starten: Modelle kommen aus der App-Shell (Service Worker), Menü erst nach dem Laden
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Testmodus' }).waitFor({ timeout: 60_000 });
  const offline = await modelState(page);
  expect(offline.models.ready).toBe(true);
  expect(offline.models.error).toBe('');
  expect(offline.ids).toEqual(online.ids);

  // Ein Fahrzeugmodell lässt sich in die Szene setzen; Lack-Zone ist umfärbbar
  const car = await page.evaluate(() => {
    const reg = (window as any).__kc.getModels();
    const id = reg.ids.find((i: string) => reg.entry(i).kind === 'vehicle');
    const inst = reg.instantiate(id, 'probe');
    const meshes = inst.rootNodes[0].getChildMeshes();
    const paint = meshes.filter((m: any) => m.material?.name.endsWith('zone_paint')).length;
    const parts = meshes.filter((m: any) => m.name.includes('detach_')).length;
    const verts = meshes.reduce((n: number, m: any) => n + m.getTotalVertices(), 0);
    inst.dispose();
    return { id, paint, parts, verts };
  });
  expect(car.paint).toBeGreaterThan(0);
  expect(car.parts).toBeGreaterThanOrEqual(2);
  expect(car.verts).toBeGreaterThan(100);
  expect(foreign).toEqual([]);
});
