# Proposal: Flugmodus

## Why

Die Welt ist inzwischen groß und detailreich (Kernstadt, Ortsteile, Straßen, Kirchen, Kleinobjekte). Zu Fuß oder mit dem Auto sieht man immer nur einen kleinen Ausschnitt. Ein Flugmodus lässt Kinder (und uns beim Testen) frei über und durch die Welt fliegen, um Orte zu entdecken und sich alles von oben anzuschauen.

## What Changes

- **Neuer Flugmodus:** Ein Knopf „Fliegen“ im Spiel (zu Fuß) schaltet in eine frei bewegliche Flugkamera. Die Spielfigur bleibt so lange eingefroren stehen.
- **Steuerung:**
  - Touch: linker Joystick bewegt vorwärts/seitwärts in Blickrichtung, Wischen dreht den Blick, Knöpfe „Hoch“ und „Runter“, „Schnell“ für schnelles Fliegen.
  - Tastatur (Desktop): WASD/Pfeile, Leertaste hoch, Umschalt runter, Maus bzw. Wischen zum Umsehen.
  - Bodenabstand mindestens 2 m (kein Flug ins Gelände), Höhe höchstens 400 m über dem Gelände, sanftes Beschleunigen und Abbremsen.
- **Beenden:** „Zurück“ setzt die Kamera wieder hinter die Spielfigur; „Hier landen“ setzt die Figur auf den Boden unter der Flugkamera.
- **Streaming folgt der Flugkamera:** Kacheln laden um die Kameraposition; in großer Höhe ohne volle Details (keine Kollision, Kleinobjekte und Fahrzeuge), dafür weitere Sicht über vereinfachte Kacheln. Die Fluggeschwindigkeit ist so begrenzt, dass das Nachladen mithält.
- **Leistung:** Ziel bleibt Ø ≥ 30 fps auf dem iPad Pro 1. Gen, auch im Flug in der Höhe; Messung mit einer Testroute im Flug.

**Nicht in diesem Change:**
- Flugzeuge, Hubschrauber oder andere Flugfahrzeuge mit Physik
- Kamerafahrten/Filme, Fotomodus mit Speichern
- Kollision der Flugkamera mit Gebäuden (die Kamera darf durch Wände fliegen; nur das Gelände begrenzt nach unten)

## Capabilities

### New Capabilities

- `fly-mode`: Ein- und Ausschalten des Flugmodus, Steuerung der Flugkamera per Touch und Tastatur, Grenzen (Bodenabstand, Höhe, Geschwindigkeit), Verhalten der Spielfigur, Landen.

### Modified Capabilities

- `world-streaming`: Die Detailstufen-Ringe richten sich im Flugmodus nach der Flugkamera statt nach der Spielfigur; in großer Höhe entfällt die volle Detailstufe.

## Impact

- **Spiel:**
  - neue Module `fly/` (reine Flug-Rechnung, Höhenregeln, Babylon-Adapter auf die vorhandene `ArcRotateCamera`)
  - `World.ts`: Streaming-Mittelpunkt und Kamera wechseln zwischen Spielfigur und Flug
  - `PlayerController`: Figur einfrieren und wieder freigeben, Landen per vorhandenem Teleport
  - `StreamingPlanner`: Option, ab einer Höhe keine Ring-0-Kacheln anzufordern
  - UI: Knopf „Fliegen“, eigene Flugsteuerung (Joystick, Blickfeld, Hoch/Runter/Schnell, Zurück/Hier landen)
  - Store: Flugzustand
- **Keine Änderung** an Kachelformat, Pipeline oder Spielstand (Flugposition wird nicht gespeichert).
