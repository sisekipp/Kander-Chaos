import type { World } from './World.ts';

let current: World | null = null;
export const getWorld = () => current;
export const setWorld = (w: World | null) => {
  current = w;
};
