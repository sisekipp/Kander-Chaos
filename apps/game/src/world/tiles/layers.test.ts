import { describe, expect, it } from 'vite-plus/test';
import { LayerRegistry } from './layers.ts';

describe('Layer-Register', () => {
  it('meldet "bereit" in Reihenfolge und "entladen" in umgekehrter Reihenfolge', () => {
    const log: string[] = [];
    const r = new LayerRegistry<string>();
    r.add({
      name: 'gelände',
      onTileReady: (t) => log.push(`gelände+${t}`),
      onTileUnload: (t) => log.push(`gelände-${t}`),
    });
    r.add({ name: 'props', onTileReady: (t) => log.push(`props+${t}`), onTileUnload: (t) => log.push(`props-${t}`) });
    r.add({ name: 'still' });
    r.ready('0,0');
    r.unload('0,0');
    expect(log).toEqual(['gelände+0,0', 'props+0,0', 'props-0,0', 'gelände-0,0']);
    expect(r.names).toEqual(['gelände', 'props', 'still']);
  });

  it('verhindert doppelte Namen', () => {
    const r = new LayerRegistry<string>();
    r.add({ name: 'a' });
    expect(() => r.add({ name: 'a' })).toThrow(/schon registriert/);
  });
});
