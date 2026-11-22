import { input } from '../../player/input.ts';

/** Einsteigen/Aussteigen: löst das einmalige Aktionsereignis aus. */
export function ActionButton({ label }: { label: string }) {
  return (
    <button
      className="hold action"
      onPointerDown={(e) => {
        e.stopPropagation();
        input.action = true;
      }}
    >
      {label}
    </button>
  );
}
