import { useEffect, useRef, useState } from 'react';
import { input } from '../../player/input.ts';

const RADIUS = 60;

/** Virtueller Joystick: erscheint dort, wo der Finger aufsetzt; schreibt moveX/moveY in den Eingabezustand. */
export function Joystick({ hint }: { hint: string }) {
  const [stick, setStick] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const id = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  useEffect(
    () => () => {
      input.moveX = 0;
      input.moveY = 0;
    },
    [],
  );

  const down = (e: React.PointerEvent) => {
    if (id.current !== null) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    id.current = e.pointerId;
    origin.current = { x: e.clientX, y: e.clientY };
    setStick({ x: e.clientX, y: e.clientY, dx: 0, dy: 0 });
  };
  const move = (e: React.PointerEvent) => {
    if (e.pointerId !== id.current) return;
    let dx = e.clientX - origin.current.x,
      dy = e.clientY - origin.current.y;
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS;
      dy = (dy / len) * RADIUS;
    }
    input.moveX = dx / RADIUS;
    input.moveY = -dy / RADIUS;
    setStick({ x: origin.current.x, y: origin.current.y, dx, dy });
  };
  const up = (e: React.PointerEvent) => {
    if (e.pointerId !== id.current) return;
    id.current = null;
    input.moveX = 0;
    input.moveY = 0;
    setStick(null);
  };

  return (
    <div className="touch-left" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      {stick && (
        <div className="stick-base" style={{ left: stick.x - RADIUS, top: stick.y - RADIUS }}>
          <div className="stick-knob" style={{ transform: `translate(${stick.dx}px, ${stick.dy}px)` }} />
        </div>
      )}
      {!stick && <div className="stick-hint">{hint}</div>}
    </div>
  );
}
