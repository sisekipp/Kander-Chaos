import { describe, expect, it } from 'vite-plus/test';
import { PROP_SHAPE_COUNT, type PropShape } from './shapes.ts';
import { SHAPE_MODELS } from './shapes.ts';

describe('Modelle je Form', () => {
  it('jede Form hat eine eigene Modell-ID', () => {
    const ids = Array.from({ length: PROP_SHAPE_COUNT }, (_, s) => SHAPE_MODELS[s as PropShape]);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(PROP_SHAPE_COUNT);
  });
});
