/**
 * Feste Physik-Teilschritte mit Obergrenze pro Bild (reine Logik).
 * Babylon addiert die Bildzeit auf einen Akkumulator und rechnet so viele Teilschritte, wie hineinpassen –
 * ohne Obergrenze. Wir kappen den Akkumulator vorher, sodass höchstens `maxSteps` Schritte entstehen;
 * überschüssige Zeit wird verworfen (Spiel läuft bei sehr niedriger Bildrate kurz langsamer statt zu ruckeln).
 */
export function clampAccumulator(accMs: number, frameMs: number, stepMs: number, maxSteps: number): number {
  const maxAfter = stepMs * maxSteps + stepMs * 0.999; // nach Addition dürfen höchstens maxSteps ganze Schritte drin sein
  // Darf negativ werden: bei einem Hänger (frameMs groß) bleiben nach der Addition trotzdem nur maxSteps Schritte.
  return Math.min(accMs, maxAfter - frameMs);
}
