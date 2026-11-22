# Tasks

Für alle Aufgaben gilt die Codestruktur aus Design D7: höchstens 300 Zeilen je Datei, Rechenlogik ohne Babylon-Import in eigenen Modulen, `modul.test.ts` neben `modul.ts`. Eine Aufgabe ist erst erledigt, wenn ihre Tests grün sind und `vp check` fehlerfrei läuft.

## 1. Flug-Rechnung

- [x] 1.1 `fly/flyMath.ts`: Flugschritt (Wunschgeschwindigkeit aus Joystick/Hoch/Runter/Schnell relativ zum Gierwinkel, sanftes Beschleunigen/Abbremsen), Bodenabstand ≥ 2 m, Höhe ≤ 400 m über Gelände, Weltgrenzen, Höchstgeschwindigkeit nach Höhe (≤ 25 m/s unter 120 m, ≤ 50 m/s darüber); Unit-Tests für jede Regel
- [x] 1.2 `fly/detailRule.ts`: volle Detailstufe aus/an mit Hysterese (aus über 120 m, an unter 100 m über Gelände); Unit-Test

## 2. Streaming und Figur

- [x] 2.1 `StreamingPlanner`: Option `fullDetail` (Ring 0 → Ring 1); Unit-Test; `TileManager.update` reicht sie durch
- [x] 2.2 `PlayerController.suspend()`/`resume()` und Rückkehr wie beim Teleport; Unit- bzw. Browsertest, dass die Figur nach dem Flug an ihrer Stelle steht und steuerbar ist
- [x] 2.3 `World.ts`: Moduswechsel Laufen ↔ Fliegen, Streaming-Mittelpunkt und Panorama folgen der Flugkamera, Kamera-Übergang 0,5 s

## 3. Steuerung und Oberfläche

- [x] 3.1 `fly/FlyController.ts` (Babylon-Adapter auf die ArcRotateCamera, Geländehöhe aus dem TileManager mit Rückfall auf die letzte bekannte Höhe)
- [x] 3.2 `input.flyUp`/`flyDown`, Tastatur (Leertaste/Umschalt im Flug), Store-Feld `flying`
- [x] 3.3 `ui/controls/FlyControls.tsx` (Joystick, Blickfeld, Hoch/Runter/Schnell, Zurück, Hier landen) und Knopf „Fliegen“ in der Laufsteuerung (nicht beim Fahren)

## 4. Tests und Messung

- [x] 4.1 E2E: Losfliegen, Steigen auf 200 m → keine Ring-0-Kacheln/Kleinobjekte/Fahrzeuge mehr, Sinken → Ring 0 wieder da; „Zurück“ → Figur steht am Startpunkt und läuft; „Hier landen“ in Wollbach → Figur steht dort am Boden; beim Fahren kein Knopf „Fliegen“; unter der Kamera ist während eines Schnellflugs immer Gelände geladen
- [x] 4.2 Messroute „Flug“ im Testmodus (Kernstadt in 100 m Höhe, Schnellflug nach Wollbach, Tiefflug zurück) mit Messbericht; Desktop-Wert in `docs/perf/README.md`
- [ ] 4.3 Messung auf dem iPad Pro 1. Gen (Ziel Ø ≥ 30 fps, 1-%-Low ≥ 20 fps), Ergebnis in `docs/perf/<datum>-flug.md`

## Workflow follow-up

- Nach Abnahme den Change archivieren und die Specs übernehmen.
