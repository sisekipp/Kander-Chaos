import { useGameStore } from '../../state/store.ts';
import { ActionButton } from './ActionButton.tsx';
import { HoldButton } from './HoldButton.tsx';
import { Joystick } from './Joystick.tsx';
import { LookPad } from './LookPad.tsx';

/** Zu Fuß: Joystick links, Kamerawischen rechts, Springen und – in Reichweite – Einsteigen. */
export function WalkControls() {
  const canEnter = useGameStore((s) => s.play.canEnter);
  return (
    <div className="touch-layer">
      <Joystick hint="Hier wischen zum Laufen" />
      <LookPad>
        <div className="button-cluster">
          {canEnter && <ActionButton label="Einsteigen" />}
          <HoldButton field="jump" label="Springen" />
        </div>
      </LookPad>
    </div>
  );
}
