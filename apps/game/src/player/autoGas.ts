/** Fahrpedale aus der Eingabe (reine Logik). „Einfach“-Modus: Gas automatisch, solange gelenkt wird. */
export interface DriveInput {
  moveX: number;
  moveY: number;
  gas: boolean;
  brake: boolean;
}

export function drivePedals(i: DriveInput, simple: boolean): { steer: number; gas: number; brake: number } {
  const steer = Math.max(-1, Math.min(1, i.moveX));
  if (i.brake) return { steer, gas: 0, brake: 1 };
  if (simple) {
    const deflection = Math.min(1, Math.hypot(i.moveX, i.moveY));
    if (i.moveY < -0.5) return { steer, gas: 0, brake: Math.min(1, -i.moveY) }; // zurückziehen = bremsen/rückwärts
    return { steer, gas: i.gas ? 1 : deflection > 0.15 ? Math.max(0.6, deflection) : 0, brake: 0 };
  }
  return { steer, gas: i.gas ? 1 : Math.max(0, i.moveY), brake: i.moveY < -0.5 ? -i.moveY : 0 };
}
