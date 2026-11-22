/** Wandelt Joystick-Eingabe (x = rechts, y = vorwärts) in eine Weltrichtung relativ zur Kamera um. */
export function cameraRelativeMove(
  moveX: number,
  moveY: number,
  camYaw: number,
): { mx: number; mz: number; len: number } {
  const fx = Math.sin(camYaw),
    fz = Math.cos(camYaw);
  const rx = Math.cos(camYaw),
    rz = -Math.sin(camYaw);
  let mx = rx * moveX + fx * moveY;
  let mz = rz * moveX + fz * moveY;
  const len = Math.hypot(mx, mz);
  if (len > 1) {
    mx /= len;
    mz /= len;
  }
  return { mx, mz, len: Math.min(len, 1) };
}
