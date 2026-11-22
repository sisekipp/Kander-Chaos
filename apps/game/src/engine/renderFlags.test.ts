import { describe, expect, it } from 'vite-plus/test';
import { uniformBuffersEnabled } from './renderFlags.ts';

describe('uniformBuffersEnabled', () => {
  it('ist ohne Angaben an', () => {
    expect(uniformBuffersEnabled('', null)).toBe(true);
  });
  it('folgt der gespeicherten Einstellung', () => {
    expect(uniformBuffersEnabled('', '0')).toBe(false);
    expect(uniformBuffersEnabled('', '1')).toBe(true);
  });
  it('URL-Parameter hat Vorrang vor der gespeicherten Einstellung', () => {
    expect(uniformBuffersEnabled('?debug&ubo=0', '1')).toBe(false);
    expect(uniformBuffersEnabled('?ubo=on', '0')).toBe(true);
    expect(uniformBuffersEnabled('?ubo=off', null)).toBe(false);
  });
});
