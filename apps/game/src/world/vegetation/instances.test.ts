import { describe, expect, it } from 'vite-plus/test';
import { offsetInstanceMatrices } from './instances.ts';

describe('Instanzmatrizen', () => {
  it('verschiebt nur die Translation jeder Matrix', () => {
    const m = new Float32Array(32);
    m[0] = 1;
    m[12] = 5;
    m[13] = 7;
    m[14] = 9;
    m[16 + 12] = 1;
    m[16 + 14] = 2;
    offsetInstanceMatrices(m, 250, -500);
    expect([m[0], m[12], m[13], m[14]]).toEqual([1, 255, 7, -491]);
    expect([m[28], m[30]]).toEqual([251, -498]);
  });
});
