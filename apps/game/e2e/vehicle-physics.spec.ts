import { expect, test, type Page } from '@playwright/test';
import { firstVisit, waitPlayable } from './helpers.ts';

test.setTimeout(300_000);

/** Sucht eine lange, gerade, flache Straße bzw. eine steile Straße in der Nähe des Startpunkts (aus Kacheldaten). */
async function setup(page: Page) {
  await firstVisit(page);
  await page.getByRole('button', { name: 'Testmodus' }).click();
  await waitPlayable(page);
}

async function place(page: Page, x: number, z: number) {
  await page.evaluate(({ x, z }) => (window as any).__kc.getWorld().player.teleport(x, z), { x, z });
  await page.waitForFunction(
    () => {
      const w = (window as any).__kc.getWorld();
      return w.tiles.isSettled && !w.player.isFrozen;
    },
    null,
    { timeout: 60_000, polling: 300 },
  );
}

/** Fährt `kind` mit Vollgas geradeaus und misst die Endgeschwindigkeit (km/h). */
async function topSpeed(page: Page, kind: number, seconds: number): Promise<number> {
  return page.evaluate(
    async ({ kind, seconds }) => {
      const v = (window as any).__kcSpawn(kind, 6);
      await new Promise((r) => setTimeout(r, 1500));
      v.controls.gas = 1;
      let max = 0;
      const t0 = performance.now();
      while (performance.now() - t0 < seconds * 1000) {
        await new Promise((r) => setTimeout(r, 200));
        max = Math.max(max, v.forwardSpeed * 3.6);
      }
      v.controls.gas = 0;
      return max;
    },
    { kind, seconds },
  );
}

test('Endgeschwindigkeiten je Fahrzeugart innerhalb ±15 % der Richtwerte', async ({ page }) => {
  await setup(page);
  // flachste freie Kachel (Wiese bei Wollbach, 6 m Höhenunterschied auf 250 m), Fahrt nach Norden
  const results: Record<string, number> = {};
  for (const [kind, name, target] of [
    [0, 'Auto', 80],
    [2, 'Motorrad', 90],
    [1, 'Fahrrad', 30],
  ] as const) {
    await place(page, -1375, -5480);
    results[name] = await topSpeed(page, kind, kind === 1 ? 12 : 18);
    console.log(`${name}: ${results[name].toFixed(1)} km/h (Ziel ${target})`);
    expect(results[name]).toBeGreaterThan(target * 0.85);
    expect(results[name]).toBeLessThan(target * 1.15);
  }
});

/** Spawnt ein Fahrzeug an fester Stelle und fährt `seconds` mit gegebener Steuerung; liefert eine Spur. */
async function drive(
  page: Page,
  kind: number,
  at: { x: number; z: number; heading: number },
  controls: { gas: number; steer?: number },
  seconds: number,
) {
  await place(page, at.x - Math.sin(at.heading) * 8, at.z - Math.cos(at.heading) * 8);
  return page.evaluate(
    async ({ kind, at, controls, seconds }) => {
      const v = (window as any).__kcSpawn(kind, 0, at);
      (window as any).__testVehicle = v;
      await new Promise((r) => setTimeout(r, 1500));
      v.controls.gas = controls.gas;
      v.controls.steer = controls.steer ?? 0;
      const trace: { x: number; y: number; z: number; up: number; kmh: number }[] = [];
      const t0 = performance.now();
      while (performance.now() - t0 < seconds * 1000) {
        await new Promise((r) => setTimeout(r, 200));
        const m = v.model.root.getWorldMatrix();
        trace.push({ x: v.position.x, y: v.position.y, z: v.position.z, up: m.m[5], kmh: v.forwardSpeed * 3.6 });
      }
      v.controls.gas = 0;
      return trace;
    },
    { kind, at, controls, seconds },
  );
}

/** Punkt-in-Polygon (flach [x0,z0,...]) für die Wand-Prüfung. */
function inside(x: number, z: number, p: number[]): boolean {
  let r = false;
  for (let i = 0, j = p.length / 2 - 1; i < p.length / 2; j = i++) {
    const xi = p[i * 2],
      zi = p[i * 2 + 1],
      xj = p[j * 2],
      zj = p[j * 2 + 1];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) r = !r;
  }
  return r;
}

// Fundstellen aus den Weltdaten (Suche nach Hang ~30 % auf freier Wiese bzw. freier Hauswand nahe dem Blumenplatz)
const SLOPE = { x: -1870, z: 2710, heading: -0.548 }; // 30 % auf 35 m
const WALL = {
  x: -102.3,
  z: 128.6,
  heading: 2.085,
  outline: [-71.9, 121.5, -80.5, 106.3, -73.2, 102.7, -63.6, 98, -56.1, 115.6],
};

test('Auto schafft 30 % Steigung aus eigener Kraft', async ({ page }) => {
  await setup(page);
  const trace = await drive(page, 0, SLOPE, { gas: 1 }, 8);
  const rise = Math.max(...trace.map((p) => p.y)) - trace[0].y;
  console.log(
    `Steigung: ${rise.toFixed(1)} m Höhengewinn, max ${Math.max(...trace.map((p) => p.kmh)).toFixed(0)} km/h`,
  );
  expect(rise).toBeGreaterThan(35 * 0.3 * 0.8);
});

test('Auto prallt an einer Hauswand ab statt durchzufahren', async ({ page }) => {
  await setup(page);
  const trace = await drive(page, 0, WALL, { gas: 1 }, 6);
  const maxKmh = Math.max(...trace.map((p) => p.kmh));
  console.log(`Wand: max ${maxKmh.toFixed(0)} km/h, Ende ${trace.at(-1)!.kmh.toFixed(0)} km/h`);
  expect(maxKmh).toBeGreaterThan(25); // wirklich mit Tempo angefahren
  for (const p of trace) expect(inside(p.x, p.z, WALL.outline)).toBe(false);
});

test('Fahrrad kippt in enger Kurve nicht um; Motorrad neigt sich in die Kurve', async ({ page }) => {
  await setup(page);
  const bike = await drive(page, 1, { x: -1375, z: -5440, heading: 0 }, { gas: 1, steer: 1 }, 7);
  expect(Math.min(...bike.slice(5).map((p) => p.up))).toBeGreaterThan(0.6);
  const moto = await drive(page, 2, { x: -1375, z: -5440, heading: 0 }, { gas: 1, steer: 0.6 }, 6);
  const lean = await page.evaluate(() => (window as any).__testVehicle.model.root.getWorldMatrix().m[1]);
  console.log(
    `Fahrrad min up ${Math.min(...bike.map((p) => p.up)).toFixed(2)}, Motorrad Neigung (right.y) ${lean.toFixed(2)}`,
  );
  expect(Math.min(...moto.slice(5).map((p) => p.up))).toBeGreaterThan(0.6);
  expect(Math.abs(lean)).toBeGreaterThan(0.05); // sichtbar geneigt
});

test('Auto auf dem Dach richtet sich nach etwa 2 s wieder auf', async ({ page }) => {
  await setup(page);
  await drive(page, 0, { x: -1375, z: -5440, heading: 0 }, { gas: 0 }, 1);
  const ups = await page.evaluate(async () => {
    const v = (window as any).__testVehicle;
    v.body.disablePreStep = false;
    v.model.root.position.y += 1.5;
    v.model.root.rotationQuaternion = v.model.root.rotationQuaternion.multiply(
      new v.model.root.rotationQuaternion.constructor(0, 0, 1, 0), // 180° um die Längsachse
    );
    await new Promise((r) => setTimeout(r, 100));
    v.body.disablePreStep = true;
    const out: number[] = [];
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 200));
      out.push(v.model.root.getWorldMatrix().m[5]);
    }
    return out;
  });
  console.log(`up-Verlauf: ${ups.map((u: number) => u.toFixed(1)).join(' ')}`);
  expect(Math.min(...ups.slice(0, 5))).toBeLessThan(0); // lag wirklich auf dem Dach
  expect(ups.at(-1)).toBeGreaterThan(0.9);
});
