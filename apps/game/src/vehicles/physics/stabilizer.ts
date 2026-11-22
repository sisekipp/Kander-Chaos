/** Zweirad-Stabilisator (reine Logik): hält das Rad aufrecht und neigt es in die Kurve (Design D1). */

/** Zielneigung (rad, positiv = nach rechts) aus Lenkung und Tempo. */
export function targetLean(steer: number, forwardSpeed: number, maxSpeed: number, maxLean: number): number {
  const speedFactor = Math.min(1, Math.abs(forwardSpeed) / (maxSpeed * 0.5));
  return Math.max(-maxLean, Math.min(maxLean, steer * maxLean * speedFactor * 1.4));
}

/** PD-Regler: Drehmoment um die Längsachse, das die Neigung auf das Ziel bringt. */
export function rollTorque(roll: number, rollRate: number, target: number, kp: number, kd: number): number {
  return -(roll - target) * kp - rollRate * kd;
}
