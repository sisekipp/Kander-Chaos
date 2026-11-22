/** Volle Detailstufe (Ring 0) abhängig von der Flughöhe, mit Hysterese gegen Flackern (Spec world-streaming). */
export const DETAIL_OFF_ABOVE = 120;
export const DETAIL_ON_BELOW = 100;

/** Neuer Zustand „volle Details“ aus bisherigem Zustand und Höhe über Gelände. */
export function fullDetailFor(current: boolean, altitude: number): boolean {
  if (current && altitude > DETAIL_OFF_ABOVE) return false;
  if (!current && altitude < DETAIL_ON_BELOW) return true;
  return current;
}
