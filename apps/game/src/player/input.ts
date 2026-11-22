/**
 * Gemeinsamer Eingabezustand (veränderliches Objekt, kein React-State): Touch-Joystick,
 * Kamerawischen und Tastatur schreiben hinein, die Spielfigur liest pro Bild.
 */
export const input = {
  /** Bewegung -1..1 (x = rechts, y = vorwärts). */
  moveX: 0,
  moveY: 0,
  /** Aufgelaufene Kameradrehung seit dem letzten Bild (Radiant). */
  lookDX: 0,
  lookDY: 0,
  fast: false,
  jump: false,
};

const keys = new Set<string>();

function applyKeys(): void {
  const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  const r = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  if (keys.size > 0 || f !== 0 || r !== 0) {
    input.moveX = r;
    input.moveY = f;
  }
  if (keys.has('Space')) input.jump = true;
}

/** Tastatur für Desktop-Tests (WASD/Pfeile, Leertaste). */
export function attachKeyboard(): () => void {
  const down = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    keys.add(e.code);
    applyKeys();
  };
  const up = (e: KeyboardEvent) => {
    keys.delete(e.code);
    if (keys.size === 0) {
      input.moveX = 0;
      input.moveY = 0;
    }
    applyKeys();
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
  };
}
