import { useEffect, useRef, useState } from 'react';
import { input } from '../player/input.ts';

const RADIUS = 60;

/**
 * Virtueller Joystick (linke Hälfte, erscheint dort, wo der Finger aufsetzt) und
 * Kamerawischen (rechte Hälfte). Beides gleichzeitig bedienbar (Multitouch per Pointer-ID).
 * Schreibt direkt in den Eingabezustand – kein React-Rendering pro Bewegung außer dem Knopf.
 */
export function TouchControls() {
  const [stick, setStick] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const stickId = useRef<number | null>(null);
  const lookId = useRef<number | null>(null);
  const lookLast = useRef({ x: 0, y: 0 });
  const origin = useRef({ x: 0, y: 0 });

  useEffect(
    () => () => {
      input.moveX = 0;
      input.moveY = 0;
    },
    [],
  );

  const onLeftDown = (e: React.PointerEvent) => {
    if (stickId.current !== null) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    stickId.current = e.pointerId;
    origin.current = { x: e.clientX, y: e.clientY };
    setStick({ x: e.clientX, y: e.clientY, dx: 0, dy: 0 });
  };
  const onLeftMove = (e: React.PointerEvent) => {
    if (e.pointerId !== stickId.current) return;
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
  const onLeftUp = (e: React.PointerEvent) => {
    if (e.pointerId !== stickId.current) return;
    stickId.current = null;
    input.moveX = 0;
    input.moveY = 0;
    setStick(null);
  };

  const onRightDown = (e: React.PointerEvent) => {
    if (lookId.current !== null) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    lookId.current = e.pointerId;
    lookLast.current = { x: e.clientX, y: e.clientY };
  };
  const onRightMove = (e: React.PointerEvent) => {
    if (e.pointerId !== lookId.current) return;
    input.lookDX += (e.clientX - lookLast.current.x) * 0.006;
    input.lookDY += (e.clientY - lookLast.current.y) * 0.004;
    lookLast.current = { x: e.clientX, y: e.clientY };
  };
  const onRightUp = (e: React.PointerEvent) => {
    if (e.pointerId === lookId.current) lookId.current = null;
  };

  return (
    <div className="touch-layer">
      <div
        className="touch-left"
        onPointerDown={onLeftDown}
        onPointerMove={onLeftMove}
        onPointerUp={onLeftUp}
        onPointerCancel={onLeftUp}
      >
        {stick && (
          <div className="stick-base" style={{ left: stick.x - RADIUS, top: stick.y - RADIUS }}>
            <div className="stick-knob" style={{ transform: `translate(${stick.dx}px, ${stick.dy}px)` }} />
          </div>
        )}
        {!stick && <div className="stick-hint">Hier wischen zum Laufen</div>}
      </div>
      <div
        className="touch-right"
        onPointerDown={onRightDown}
        onPointerMove={onRightMove}
        onPointerUp={onRightUp}
        onPointerCancel={onRightUp}
      />
    </div>
  );
}
