import { describe, expect, it } from 'vite-plus/test';
import { drivePedals } from './autoGas.ts';

const none = { moveX: 0, moveY: 0, gas: false, brake: false };

describe('Fahrpedale', () => {
  it('Einfach-Modus: nur lenken genügt, das Fahrzeug fährt', () => {
    expect(drivePedals({ ...none, moveX: -1 }, true)).toEqual({ steer: -1, gas: 1, brake: 0 });
    expect(drivePedals({ ...none, moveX: 0.3 }, true).gas).toBeGreaterThanOrEqual(0.6);
  });

  it('Einfach-Modus: ohne Auslenkung kein Gas, zurückziehen bremst', () => {
    expect(drivePedals(none, true)).toEqual({ steer: 0, gas: 0, brake: 0 });
    expect(drivePedals({ ...none, moveY: -1 }, true).brake).toBe(1);
  });

  it('Normaler Modus: Gas nur per Knopf oder Joystick vor', () => {
    expect(drivePedals({ ...none, moveX: -1 }, false).gas).toBe(0);
    expect(drivePedals({ ...none, gas: true }, false).gas).toBe(1);
    expect(drivePedals({ ...none, moveY: 0.5 }, false).gas).toBe(0.5);
  });

  it('Bremsknopf hat Vorrang', () => {
    expect(drivePedals({ ...none, moveX: 1, gas: true, brake: true }, true)).toEqual({ steer: 1, gas: 0, brake: 1 });
  });
});
