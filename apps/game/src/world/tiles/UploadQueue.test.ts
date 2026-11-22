import { describe, expect, it } from 'vite-plus/test';
import { UploadQueue } from './UploadQueue.ts';

describe('Upload-Warteschlange', () => {
  it('arbeitet mindestens einen Schritt ab und hält das Budget ein', () => {
    let t = 0;
    const q = new UploadQueue(() => t);
    const ran: string[] = [];
    for (const id of ['a', 'b', 'c'])
      q.push({
        tileId: id,
        ring: 1,
        run: () => {
          ran.push(id);
          t += 3;
        },
      });
    expect(q.process(4)).toBe(2); // a (t=3 < 4) -> b (t=6) -> Budget erschöpft
    expect(ran).toEqual(['a', 'b']);
    expect(q.process(0)).toBe(1); // immer mindestens einer
  });

  it('bevorzugt Ring-0-Schritte und kann Kacheln verwerfen', () => {
    const q = new UploadQueue(() => 0);
    const ran: string[] = [];
    q.push({ tileId: 'fern', ring: 2, run: () => ran.push('fern') });
    q.push({ tileId: 'nah', ring: 0, run: () => ran.push('nah') });
    q.push({ tileId: 'weg', ring: 1, run: () => ran.push('weg') });
    q.drop('weg');
    expect(q.has('nah', 0)).toBe(true);
    q.process(0);
    expect(ran).toEqual(['nah']);
    q.process(0);
    expect(q.length).toBe(0);
    expect(ran).toEqual(['nah', 'fern']);
  });
});
