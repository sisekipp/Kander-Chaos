# Spec Delta

## Purpose

Regelt den Flugmodus: eine frei bewegliche Kamera, mit der man über und durch die Welt fliegt, um sie anzuschauen, einschließlich Steuerung, Grenzen, Verhalten der Spielfigur und Rückkehr ins Spiel.

## ADDED Requirements

### Requirement: Flugmodus ein- und ausschalten
Das Spiel SHALL zu Fuß einen gut erreichbaren Knopf „Fliegen“ anbieten. Beim Einschalten MUST die Kamera von der aktuellen Blickposition aus frei beweglich werden und die Spielfigur an ihrer Stelle eingefroren stehen bleiben. Während einer Autofahrt MUST der Knopf ausgeblendet sein.

#### Scenario: Losfliegen
- **WHEN** der Spieler zu Fuß auf „Fliegen“ tippt
- **THEN** steigt die Kamera aus der Verfolgerposition auf, die Flugsteuerung erscheint und die Figur bleibt reglos stehen

#### Scenario: Im Auto
- **WHEN** der Spieler ein Fahrzeug fährt
- **THEN** ist kein Knopf „Fliegen“ zu sehen

### Requirement: Steuerung der Flugkamera
Die Flugkamera SHALL sich per Touch (Joystick für vorwärts/seitwärts in Blickrichtung, Wischen zum Umsehen, Knöpfe „Hoch“, „Runter“ und „Schnell“) und per Tastatur (WASD bzw. Pfeiltasten, Leertaste hoch, Umschalt runter) steuern lassen. Bewegungen MUST sanft beschleunigen und abbremsen. Die Grundgeschwindigkeit MUST bei etwa 15 m/s liegen, mit „Schnell“ bei etwa 50 m/s.

#### Scenario: Geradeaus fliegen
- **WHEN** der Spieler den Joystick nach vorne drückt
- **THEN** fliegt die Kamera in Blickrichtung (waagerecht) und kommt nach dem Loslassen innerhalb einer Sekunde sanft zum Stehen

#### Scenario: Höhe ändern
- **WHEN** der Spieler „Hoch“ gedrückt hält
- **THEN** steigt die Kamera gleichmäßig, bis er loslässt oder die Höchsthöhe erreicht ist

### Requirement: Grenzen des Flugs
Die Flugkamera MUST mindestens 2 m über dem Gelände bleiben und darf höchstens 400 m über dem Gelände steigen. Sie MUST innerhalb der Weltgrenzen bleiben. Durch Gebäude darf sie hindurchfliegen.

#### Scenario: Tiefflug über einen Hügel
- **WHEN** der Spieler auf einen Hang zufliegt, ohne die Höhe zu ändern
- **THEN** hebt sich die Kamera über dem Hang, sodass sie nie weniger als 2 m über dem Gelände ist

#### Scenario: Weltrand
- **WHEN** der Spieler auf den Rand der Welt zufliegt
- **THEN** hält die Kamera am Rand an, statt ins Leere zu fliegen

### Requirement: Zurück ins Spiel und Landen
Der Flugmodus SHALL zwei Wege zurück anbieten: „Zurück“ setzt die Kamera wieder hinter die eingefrorene Spielfigur und gibt sie frei; „Hier landen“ setzt die Spielfigur auf den Boden unter der Flugkamera (an einer freien Stelle) und beendet den Flug dort. Die Flugposition MUST NOT im Spielstand gespeichert werden.

#### Scenario: Zurück zur Figur
- **WHEN** der Spieler nach einem Flug auf „Zurück“ tippt
- **THEN** steht die Figur an der Stelle, an der der Flug begann, und lässt sich sofort steuern

#### Scenario: Hier landen
- **WHEN** der Spieler über dem Marktplatz von Wollbach auf „Hier landen“ tippt
- **THEN** steht die Figur kurz darauf in Wollbach auf dem Boden und lässt sich steuern, sobald die Kollision der Kachel geladen ist

### Requirement: Leistung im Flug
Auf dem iPad Pro 1. Gen MUST der Flugmodus im Durchschnitt mindestens 30 fps erreichen, auch in großer Höhe mit weitem Blick. Die Fluggeschwindigkeit MUST so begrenzt sein, dass unter der Kamera keine Kachel ohne Gelände sichtbar wird.

#### Scenario: Messflug
- **WHEN** die Messroute „Flug“ (Kernstadt in 100 m Höhe, Schnellflug nach Wollbach, Tiefflug zurück) abgespielt wird
- **THEN** liegen Ø-Bildrate und 1-%-Low im Ziel der Leistungsvorgaben, und es werden keine Löcher im Gelände unter der Kamera sichtbar
