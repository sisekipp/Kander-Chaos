import { getWorld } from '../../world/worldInstance.ts';
import { HoldButton } from './HoldButton.tsx';
import { Joystick } from './Joystick.tsx';
import { LookPad } from './LookPad.tsx';

/**
 * Flugmodus: Joystick links (vorwärts/seitwärts in Blickrichtung), Wischen rechts zum Umsehen,
 * Hoch/Runter/Schnell zum Halten, oben „Zurück“ und „Hier landen“.
 */
export function FlyControls() {
  const stop = (land: boolean) => (e: React.PointerEvent) => {
    e.stopPropagation();
    getWorld()?.stopFlying(land);
  };
  return (
    <div className="touch-layer">
      <div className="fly-top">
        <button onPointerDown={stop(false)} aria-label="Zurück">
          Zurück
        </button>
        <button onPointerDown={stop(true)} aria-label="Hier landen">
          Hier landen
        </button>
      </div>
      <Joystick hint="Wischen zum Fliegen" />
      <LookPad>
        <div className="button-cluster fly">
          <HoldButton field="fast" label="Schnell" className="small" />
          <HoldButton field="flyDown" label="Runter" />
          <HoldButton field="flyUp" label="Hoch" />
        </div>
      </LookPad>
    </div>
  );
}
