import { useGameStore } from '../../state/store.ts';
import { ActionButton } from './ActionButton.tsx';
import { HoldButton } from './HoldButton.tsx';
import { Joystick } from './Joystick.tsx';
import { LookPad } from './LookPad.tsx';
import { getWorld } from '../../world/worldInstance.ts';

/** Zu Fuß: Joystick links, Kamerawischen rechts, Springen, Fliegen und – in Reichweite – Einsteigen. */
export function WalkControls() {
  const canEnter = useGameStore((s) => s.play.canEnter);
  return (
    <div className="touch-layer">
      <Joystick hint="Hier wischen zum Laufen" />
      <LookPad>
        <div className="button-cluster">
          {canEnter && <ActionButton label="Einsteigen" />}
          <HoldButton field="jump" label="Springen" />
          <button
            className="hold small fly"
            onPointerDown={(e) => {
              e.stopPropagation();
              getWorld()?.startFlying();
            }}
            aria-label="Fliegen"
          >
            Fliegen
          </button>
        </div>
      </LookPad>
    </div>
  );
}
