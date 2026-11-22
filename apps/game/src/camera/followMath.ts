/** Kamera-Mathematik ohne Babylon (testbar). Konvention wie Babylons ArcRotateCamera. */

/** Winkel auf (-π, π]. */
export function wrapAngle(a: number): number {
  let r = a % (2 * Math.PI);
  if (r <= -Math.PI) r += 2 * Math.PI;
  if (r > Math.PI) r -= 2 * Math.PI;
  return r;
}

/** Bildratenunabhängige Glättung: Anteil, um den man sich dem Ziel pro Schritt nähert. */
export function smoothFactor(ratePerSec: number, dtSec: number): number {
  return 1 - Math.exp(-ratePerSec * dtSec);
}

/** Blickrichtung (Gierwinkel, 0 = Norden/+z, π/2 = Osten/+x) einer ArcRotateCamera mit Winkel alpha. */
export function cameraForwardYaw(alpha: number): number {
  return wrapAngle(-alpha - Math.PI / 2);
}

/** alpha, bei dem die Kamera genau hinter einem Objekt mit Gierwinkel `yaw` steht. */
export function behindAlpha(yaw: number): number {
  return Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
}

/**
 * Fahrkamera: schwenkt nach dem Loslassen hinter das Fahrzeug zurück. Ab `delaySec` ohne Wischen
 * wird mit einer Rate gedreht, die den Rückweg in höchstens `returnSec` schafft.
 */
export function chaseAlpha(
  current: number,
  yaw: number,
  dtSec: number,
  idleSec: number,
  delaySec = 0.3,
  returnSec = 2,
): number {
  if (idleSec < delaySec) return current;
  const target = behindAlpha(yaw);
  const diff = wrapAngle(target - current);
  // Rate so, dass nach (returnSec - delaySec) weniger als 2 % Restwinkel übrig sind
  const rate = Math.log(50) / Math.max(0.1, returnSec - delaySec);
  return current + diff * smoothFactor(rate, dtSec);
}

/** Kameraabstand beim Fahren: wächst mit der Geschwindigkeit (m/s). */
export function zoomForSpeed(speed: number, min = 7, max = 14): number {
  return Math.min(max, Math.max(min, min + Math.abs(speed) * 0.28));
}
