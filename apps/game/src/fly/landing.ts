/** Kandidaten für „Hier landen“: die Stelle selbst, dann Ringe mit 4, 8, 12 und 16 m Abstand (je 8 Richtungen). */
export function landingCandidates(x: number, z: number): { x: number; z: number }[] {
  const out = [{ x, z }];
  for (const r of [4, 8, 12, 16])
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      out.push({ x: x + Math.cos(a) * r, z: z + Math.sin(a) * r });
    }
  return out;
}

/**
 * Erste freie Stelle: `roofAt` liefert die Höhe der obersten Fläche an (x, z) (Physik-Raycast von oben),
 * `groundAt` die Geländehöhe. Frei ist eine Stelle, wenn über dem Gelände nichts steht (Gebäude, Fahrzeug).
 */
export function firstFreeSpot(
  x: number,
  z: number,
  groundAt: (x: number, z: number) => number | null,
  roofAt: (x: number, z: number) => number | null,
): { x: number; z: number } {
  for (const c of landingCandidates(x, z)) {
    const g = groundAt(c.x, c.z);
    if (g === null) continue;
    const top = roofAt(c.x, c.z);
    if (top === null || top <= g + 0.5) return c;
  }
  return { x, z };
}
