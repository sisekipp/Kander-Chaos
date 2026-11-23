import { useEffect, useState } from 'react';
import { getWorld } from '../../world/worldInstance.ts';
import { HoldButton } from './HoldButton.tsx';
import { Joystick } from './Joystick.tsx';
import { LookPad } from './LookPad.tsx';

/**
 * Hubschrauber: Joystick links (Richtung relativ zur Kamera), Wischen rechts zum Umsehen, Hoch/Runter/Schnell
 * zum Halten; „Aussteigen“ nur am Boden (Spec helicopter).
 */
export function HeliControls() {
  const [canExit, setCanExit] = useState(false);
  useEffect(() => {
    const t = window.setInterval(() => setCanExit(!!getWorld()?.heli?.canExit), 250);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="touch-layer">
      {canExit && (
        <div className="fly-top">
          <button
            onPointerDown={(e) => {
              e.stopPropagation();
              getWorld()?.heli?.exit();
            }}
            aria-label="Aussteigen"
          >
            Aussteigen
          </button>
        </div>
      )}
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
