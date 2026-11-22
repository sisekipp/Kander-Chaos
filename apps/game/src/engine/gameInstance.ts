import type { Game } from './Game.ts';

type Listener = (game: Game | null) => void;
let current: Game | null = null;
const listeners = new Set<Listener>();

/** Globale Referenz auf die laufende Engine für UI-Befehle (kein React-State!). */
export function getGame(): Game | null {
  return current;
}

export function setGame(game: Game | null): void {
  current = game;
  for (const l of listeners) l(game);
}

export function onGameChange(fn: Listener): () => void {
  listeners.add(fn);
  fn(current);
  return () => listeners.delete(fn);
}
