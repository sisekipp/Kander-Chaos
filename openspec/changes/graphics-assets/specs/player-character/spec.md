# Spec Delta

## Purpose

Legt Aussehen, Varianten und Animationen der Spielfigur fest, damit sich Laufen, Springen und Ein- und Aussteigen lebendig anfühlen.

## ADDED Requirements

### Requirement: Kindgerechte Spielfigur
Die Spielfigur SHALL ein stilisiertes, freundliches Modell aus der Asset-Pipeline sein (keine Kapsel mehr), mit mindestens 4 wählbaren Farbvarianten (Kleidung, Haare). Die gewählte Variante MUST im Spielstand gespeichert werden.

#### Scenario: Variante wählen
- **WHEN** der Spieler im Menü eine andere Figurvariante wählt und das Spiel neu startet
- **THEN** erscheint die gewählte Variante

### Requirement: Animationen der Spielfigur
Die Spielfigur SHALL Animationen für Stehen, Gehen, Rennen (Schnellmodus), Springen/Fallen sowie Ein- und Aussteigen haben. Die Übergänge MUST weich überblendet werden. Geh- und Renngeschwindigkeit MUST zur Bewegung passen (kein Rutschen der Füße).

#### Scenario: Losgehen
- **WHEN** der Spieler aus dem Stand den Joystick nach vorne drückt
- **THEN** blendet die Figur innerhalb von 0,3 s vom Stehen ins Gehen über

#### Scenario: Einsteigen
- **WHEN** der Spieler „Einsteigen“ antippt
- **THEN** spielt die Figur eine kurze Einsteige-Animation, bevor sie im Fahrzeug verschwindet

### Requirement: Figur auf dem Fahrrad und Motorrad sichtbar
Auf Fahrrad und Motorrad SHALL die Figur sichtbar sitzen (Sitz-Animation) und sich mit dem Zweirad in die Kurve neigen. Im Auto MUST sie nicht sichtbar sein müssen.

#### Scenario: Fahrrad fahren
- **WHEN** der Spieler Fahrrad fährt
- **THEN** sitzt die Figur sichtbar auf dem Rad und neigt sich mit ihm

### Requirement: Leistung der Spielfigur
Die Spielfigur SHALL das einzige Modell mit Echtzeit-Skelettanimation sein und höchstens 3.000 Dreiecke haben.

#### Scenario: Dreieckszahl
- **WHEN** das Figurmodell geladen ist
- **THEN** hat es höchstens 3.000 Dreiecke
