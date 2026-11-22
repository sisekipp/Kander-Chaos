/** Deterministischer Hash (FNV-1a über die Ziffern) -> [0,1). Gleiche ID ergibt immer denselben Wert. */
export function hash01(id: number, salt = 0): number {
  let h = 0x811c9dc5 ^ salt;
  const s = String(id);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
