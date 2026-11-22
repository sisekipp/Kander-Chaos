import { describe, expect, it } from 'vite-plus/test';
import { BodyBudget } from './logic.ts';

describe('Physik-Budget', () => {
  it('nie mehr als 60 Trümmer – die ältesten fallen zuerst weg', () => {
    const b = new BodyBudget();
    const removed: number[] = [];
    const ids: number[] = [];
    for (let i = 0; i < 70; i++) {
      const r = b.add('debris', i);
      ids.push(r.id);
      removed.push(...r.actions.map((a) => a.id));
    }
    expect(b.countOf('debris')).toBe(60);
    expect(removed.slice(0, 3)).toEqual(ids.slice(0, 3));
  });

  it('nie mehr als 80 dynamische Körper; Fahrzeuge werden nie verdrängt, ruhende Props eingefroren', () => {
    const b = new BodyBudget();
    for (let i = 0; i < 8; i++) b.add('vehicle', 0);
    const props: number[] = [];
    for (let i = 0; i < 72; i++) props.push(b.add('prop', 1 + i).id);
    for (const id of props.slice(0, 5)) b.setResting(id, true, 100);
    const r = b.add('prop', 200);
    expect(b.count).toBe(80);
    expect(r.actions).toEqual([{ id: props[0], action: 'freeze' }]);
    expect(b.countOf('vehicle')).toBe(8);
  });

  it('ruhende Trümmer werden vor ruhenden Props entfernt', () => {
    const b = new BodyBudget({
      maxBodies: 3,
      maxDebris: 60,
      fadeAfterMs: { prop: 8000, debris: 8000, part: 10000, wreck: 20000 },
    });
    const p = b.add('prop', 0).id;
    const d = b.add('debris', 1).id;
    b.add('vehicle', 2);
    b.setResting(p, true, 3);
    b.setResting(d, true, 3);
    expect(b.add('debris', 4).actions).toEqual([{ id: d, action: 'remove' }]);
  });

  it('Ausblenden nach Ruhezeit je Art, Wracks ab Erstellung', () => {
    const b = new BodyBudget();
    const d = b.add('debris', 0).id;
    const part = b.add('part', 0).id;
    const w = b.add('wreck', 0).id;
    b.setResting(d, true, 1000);
    b.setResting(part, true, 1000);
    expect(b.tick(8999)).toEqual([]);
    expect(b.tick(9000)).toEqual([{ id: d, action: 'fade' }]);
    expect(b.tick(11000)).toEqual([{ id: part, action: 'fade' }]);
    expect(b.tick(20000)).toEqual([{ id: w, action: 'fade' }]);
    expect(b.tick(30000)).toEqual([]); // nicht doppelt
  });

  it('Bewegung setzt die Ruhezeit zurück', () => {
    const b = new BodyBudget();
    const d = b.add('debris', 0).id;
    b.setResting(d, true, 0);
    b.setResting(d, false, 5000);
    b.setResting(d, true, 6000);
    expect(b.tick(13000)).toEqual([]);
    expect(b.tick(14000)).toEqual([{ id: d, action: 'fade' }]);
  });

  it('Fahrzeugteile, die nie zur Ruhe kommen, verschwinden spätestens nach 15 s', () => {
    const b = new BodyBudget();
    const part = b.add('part', 0).id;
    const d = b.add('debris', 0).id;
    for (let t = 0; t < 15000; t += 1000) b.setResting(part, false, t);
    expect(b.tick(14999)).toEqual([]);
    expect(b.tick(15000)).toEqual([{ id: part, action: 'fade' }]);
    // Trümmer haben keine Höchstlebensdauer
    expect(b.tick(60000).some((a) => a.id === d)).toBe(false);
  });
});
