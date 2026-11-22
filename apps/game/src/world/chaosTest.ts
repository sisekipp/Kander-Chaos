import type { World } from './World.ts';

/**
 * Chaos-Test für die Messung auf dem Referenzgerät: löst 30 s lang alle 100 ms drei Kleinobjekte im
 * Umkreis von 250 m aus und liefert die Höchstwerte von Physikkörpern und Trümmern (Spec destructible-props).
 */
export async function runChaosTest(
  world: World,
  seconds = 30,
): Promise<{ triggered: number; maxBodies: number; maxDebris: number }> {
  const props = world.props;
  if (!props) return { triggered: 0, maxBodies: 0, maxDebris: 0 };
  const p = world.player.position;
  const near: { t: ReturnType<typeof props.allTiles> extends IterableIterator<infer T> ? T : never; i: number }[] = [];
  for (const t of props.allTiles())
    for (const q of t.props) if (Math.hypot(q.x - p.x, q.z - p.z) < 250) near.push({ t, i: q.index });
  near.sort(
    (a, b) =>
      Math.hypot(a.t.props[a.i].x - p.x, a.t.props[a.i].z - p.z) -
      Math.hypot(b.t.props[b.i].x - p.x, b.t.props[b.i].z - p.z),
  );
  let n = 0,
    maxBodies = 0,
    maxDebris = 0;
  const t0 = performance.now();
  while (performance.now() - t0 < seconds * 1000) {
    for (let k = 0; k < 3 && n < near.length; k++, n++) {
      const { t, i } = near[n];
      if (!t.rebuild.isDestroyed(i)) props.trigger(t, i, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20);
    }
    await new Promise((r) => setTimeout(r, 100));
    maxBodies = Math.max(maxBodies, world.budget.count);
    maxDebris = Math.max(maxDebris, world.budget.countOf('debris'));
  }
  return { triggered: n, maxBodies, maxDebris };
}
