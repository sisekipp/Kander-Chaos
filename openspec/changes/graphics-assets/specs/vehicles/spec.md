# Spec Delta

## ADDED Requirements

### Requirement: Europäische Fahrzeugmodelle
Fahrzeuge SHALL Modelle aus der Asset-Pipeline nutzen, die zu deutschen Straßen passen: mindestens 4 Automodelle (Kleinwagen, Kompaktwagen, Kombi, Kleintransporter), 2 Fahrradmodelle (Stadtrad, Mountainbike) und 2 motorisierte Zweiräder (Roller, Motorrad). Die Modellwahl je Parkposition MUST deterministisch aus deren ID folgen. Echte Markenlogos MUST NOT vorkommen.

#### Scenario: Vielfalt am Straßenrand
- **WHEN** der Spieler eine Wohnstraße mit mehreren geparkten Autos entlanggeht
- **THEN** stehen dort unterschiedliche Automodelle in unterschiedlichen Farben

#### Scenario: Gleiches Modell am gleichen Ort
- **WHEN** der Spieler eine Kachel verlässt und zurückkehrt
- **THEN** steht an jeder Parkposition wieder dasselbe Modell in derselben Farbe
