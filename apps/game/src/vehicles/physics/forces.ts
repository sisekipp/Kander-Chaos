/**
 * Kräfte des Arcade-Raycast-Fahrzeugs (reine Funktionen, ohne Babylon; Design D1).
 * Konvention: Kräfte in N, Geschwindigkeiten in m/s, positive Längsrichtung = vorwärts.
 */

/** Federkraft entlang der Radachse: Feder + Dämpfer, nie ziehend. */
export function suspensionForce(
  compression: number,
  compressionVelocity: number,
  stiffness: number,
  damping: number,
): number {
  if (compression <= 0) return 0;
  return Math.max(0, stiffness * compression + damping * compressionVelocity);
}

/**
 * Antriebskraft: lange nahezu volle Kraft, fällt erst kurz vor der Höchstgeschwindigkeit auf 0
 * (1 - (v/vmax)³), damit v_max trotz Fahrwiderstand fast erreicht wird.
 * Rückwärts (throttle < 0) mit halber Kraft und begrenzter Rückwärtsgeschwindigkeit.
 */
export function driveForce(
  throttle: number,
  forwardSpeed: number,
  maxSpeed: number,
  engineForce: number,
  reverseSpeed: number,
): number {
  if (throttle > 0) return engineForce * throttle * Math.max(0, 1 - (Math.max(0, forwardSpeed) / maxSpeed) ** 3);
  if (throttle < 0) return engineForce * 0.5 * throttle * Math.max(0, 1 - Math.max(0, -forwardSpeed) / reverseSpeed);
  return 0;
}

/** Lenkwinkel nimmt mit der Geschwindigkeit ab (bis 60 % weniger bei v_max) – stabil bei Tempo, wendig im Stand. */
export function steerAngle(steerInput: number, forwardSpeed: number, maxSpeed: number, maxSteer: number): number {
  const ratio = Math.min(1, Math.abs(forwardSpeed) / maxSpeed);
  return Math.max(-1, Math.min(1, steerInput)) * maxSteer * (1 - 0.6 * ratio);
}

/** Seitenhalt: wirkt der Quergeschwindigkeit am Rad entgegen, begrenzt durch die Radlast (kein „Kleben“ in der Luft). */
export function lateralForce(lateralVelocity: number, grip: number, wheelLoad: number, massShare: number): number {
  const raw = -lateralVelocity * grip * massShare;
  const limit = wheelLoad * 1.2; // Reibwert ~1,2 (Arcade, viel Grip)
  return Math.max(-limit, Math.min(limit, raw));
}

/** Bremse: wirkt der Längsgeschwindigkeit entgegen; im Stand keine Kraft (kein Zittern). */
export function brakeForce(forwardSpeed: number, brake: number, maxBrake: number): number {
  if (brake <= 0 || Math.abs(forwardSpeed) < 0.05) return 0;
  return -Math.sign(forwardSpeed) * maxBrake * brake * Math.min(1, Math.abs(forwardSpeed) / 1.5);
}

/**
 * Rollwiderstand (fast konstant, ~1,5 % des Gewichts, bei Schritttempo ausgeblendet) + Luftwiderstand (∝ v²),
 * damit das Fahrzeug ohne Gas ausrollt, mit Gas aber v_max erreicht.
 */
export function dragForce(forwardSpeed: number, mass: number, airDrag = 0.4): number {
  const rolling = mass * 9.81 * 0.015 * Math.min(1, Math.abs(forwardSpeed) / 0.5);
  return -Math.sign(forwardSpeed) * (rolling + airDrag * forwardSpeed * forwardSpeed);
}

/** Gas/Bremse aus der Eingabe: Bremse im Stand bzw. rückwärts rollend = Rückwärtsgang. */
export function pedalsFrom(gas: number, brake: number, forwardSpeed: number): { throttle: number; brake: number } {
  if (brake > 0 && forwardSpeed < 0.5 && gas === 0) return { throttle: -brake, brake: 0 };
  if (gas > 0 && forwardSpeed < -0.5) return { throttle: 0, brake: gas }; // erst abbremsen, dann vorwärts
  return { throttle: gas, brake };
}
