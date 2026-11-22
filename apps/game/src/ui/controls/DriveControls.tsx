import { useGameStore } from '../../state/store.ts';
import { ActionButton } from './ActionButton.tsx';
import { HoldButton } from './HoldButton.tsx';
import { Joystick } from './Joystick.tsx';
import { LookPad } from './LookPad.tsx';

/** Fahren: Joystick = Lenken, rechts Gas, Bremse/Rückwärts, Hupe und Aussteigen. */
export function DriveControls() {
  const simple = useGameStore((s) => s.simpleDriving);
  return (
    <div className="touch-layer">
      <Joystick hint={simple ? 'Wischen zum Lenken – Gas gibt das Auto selbst' : 'Wischen zum Lenken'} />
      <LookPad>
        <div className="button-cluster drive">
          <ActionButton label="Aussteigen" />
          <HoldButton field="horn" label="Hupe" className="small" />
          <HoldButton field="brake" label="Bremse" className="brake" />
          <HoldButton field="gas" label="Gas" className="gas" />
        </div>
      </LookPad>
    </div>
  );
}
