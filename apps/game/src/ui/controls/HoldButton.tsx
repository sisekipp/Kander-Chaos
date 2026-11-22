import { useEffect } from 'react';
import { input } from '../../player/input.ts';

type HoldKey = 'gas' | 'brake' | 'horn' | 'jump' | 'flyUp' | 'flyDown' | 'fast';

/** Großer Knopf, der einen Eingabeschalter setzt, solange er gedrückt ist (Multitouch-fähig). */
export function HoldButton({ field, label, className }: { field: HoldKey; label: string; className?: string }) {
  useEffect(
    () => () => {
      input[field] = false;
    },
    [field],
  );
  const set = (v: boolean) => (e: React.PointerEvent) => {
    e.stopPropagation();
    if (v) (e.target as HTMLElement).setPointerCapture(e.pointerId);
    input[field] = v;
  };
  return (
    <button
      className={`hold ${className ?? ''}`}
      onPointerDown={set(true)}
      onPointerUp={set(false)}
      onPointerCancel={set(false)}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={label}
    >
      {label}
    </button>
  );
}
