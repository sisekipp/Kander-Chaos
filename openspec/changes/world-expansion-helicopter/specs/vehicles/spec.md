# Spec Delta

## MODIFIED Requirements

### Requirement: Drei Fahrzeugarten
Das Spiel SHALL vier Fahrzeugarten bieten: Auto, Fahrrad, Motorrad und Hubschrauber. Die Bodenfahrzeuge MUST sich in Höchstgeschwindigkeit, Beschleunigung und Wendigkeit spürbar unterscheiden. Richtwerte: Auto ca. 80 km/h, Motorrad ca. 90 km/h, Fahrrad ca. 30 km/h. Der Hubschrauber folgt eigenen Regeln (Spec `helicopter`) und steht nur auf Landeplätzen bereit, nicht auf Parkpositionen.

#### Scenario: Unterschiedliche Höchstgeschwindigkeit
- **WHEN** der Spieler mit jeder Bodenfahrzeugart auf ebener Straße voll beschleunigt
- **THEN** erreicht das Fahrrad die niedrigste und das Motorrad die höchste Endgeschwindigkeit
- **AND** jede Endgeschwindigkeit liegt innerhalb von ±15 % ihres Richtwerts

#### Scenario: Hubschrauber nicht auf Parkplätzen
- **WHEN** Parkpositionen mit Fahrzeugen besetzt werden
- **THEN** wird dort nie ein Hubschrauber abgestellt
