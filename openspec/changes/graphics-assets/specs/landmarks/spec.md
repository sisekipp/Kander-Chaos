# Spec Delta

## Purpose

Macht markante Gebäude wiedererkennbar, indem ihr automatisch erzeugtes OSM-Gebäude durch ein eigens erstelltes Modell ersetzt wird.

## ADDED Requirements

### Requirement: Ersetzen von OSM-Gebäuden
Ein Wahrzeichen SHALL über die OSM-ID des Gebäudes einem eigenen Modell zugeordnet werden. Das prozedurale Gebäude MUST dann entfallen und das Modell an Position, Ausrichtung und Geländehöhe des Grundrisses gesetzt werden. Kollision MUST zum Modell passen.

#### Scenario: Kirche ersetzt
- **WHEN** die Kachel mit der evangelischen Kirche Kandern geladen wird
- **THEN** steht dort das Wahrzeichen-Modell statt des prozeduralen Gebäudes, und die Spielfigur kann nicht hindurchlaufen

### Requirement: Erste Wahrzeichen in Kandern
Mindestens die evangelische Kirche und das Rathaus in Kandern SHALL als Wahrzeichen-Modelle vorliegen, die in Form, Dach, Turm und Farbe dem Original nachempfunden und aus der Nähe wiedererkennbar sind.

#### Scenario: Rathaus erkennen
- **WHEN** jemand aus Kandern im Spiel vor dem Rathaus steht
- **THEN** erkennt er das Gebäude an Form, Dach und Farbe

### Requirement: Wahrzeichen im Budget
Ein Wahrzeichen-Modell SHALL höchstens 8.000 Dreiecke und höchstens 2 Draw Calls haben und dieselben Licht- und Nebelbausteine nutzen wie die übrige Welt.

#### Scenario: Grenzwerte
- **WHEN** ein Wahrzeichen-Modell in die Pipeline aufgenommen wird
- **THEN** prüft der Build Dreiecke und Materialanzahl und schlägt bei Überschreitung fehl
