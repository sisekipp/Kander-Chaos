import { useRef } from 'react';
import { input } from '../../player/input.ts';

/** Kamerawischen (rechte Bildschirmhälfte); Knöpfe liegen darüber. */
export function LookPad({ children }: { children?: React.ReactNode }) {
  const id = useRef<number | null>(null);
  const last = useRef({ x: 0, y: 0 });
  const down = (e: React.PointerEvent) => {
    if (id.current !== null || e.target !== e.currentTarget) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    id.current = e.pointerId;
    last.current = { x: e.clientX, y: e.clientY };
  };
  const move = (e: React.PointerEvent) => {
    if (e.pointerId !== id.current) return;
    input.lookDX += (e.clientX - last.current.x) * 0.006;
    input.lookDY += (e.clientY - last.current.y) * 0.004;
    last.current = { x: e.clientX, y: e.clientY };
  };
  const up = (e: React.PointerEvent) => {
    if (e.pointerId === id.current) id.current = null;
  };
  return (
    <div className="touch-right" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      {children}
    </div>
  );
}
