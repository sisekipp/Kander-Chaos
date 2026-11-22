# Spec Delta

## MODIFIED Requirements

### Requirement: Detailstufen-Ringe um den Spieler
Die Welt SHALL Kacheln in drei Detailstufen um den Spieler herum darstellen: volle Details in der Spielerkachel und ihren direkten Nachbarn, vereinfachte Darstellung im nächsten Ring und nur Gelände mit groben Silhouetten bis zur Sichtgrenze. Im Flugmodus MUST die Flugkamera an die Stelle des Spielers treten. Liegt die Flugkamera mehr als 120 m über dem Gelände, MUST die volle Detailstufe entfallen (keine Kollision, Kleinobjekte oder Fahrzeuge); die nächstgelegenen Kacheln werden dann vereinfacht dargestellt.

#### Scenario: Wechsel der Detailstufe
- **WHEN** der Spieler eine Kachelgrenze überquert
- **THEN** werden Kacheln, die in einen näheren Ring wandern, auf die höhere Detailstufe gebracht
- **AND** Kacheln, die in einen ferneren Ring wandern, auf eine niedrigere Stufe gesetzt

#### Scenario: Hoher Flug
- **WHEN** die Flugkamera auf 200 m über dem Gelände steigt
- **THEN** werden die Kacheln unter der Kamera vereinfacht dargestellt und ihre Kleinobjekte, Fahrzeuge und Kollisionen entladen

#### Scenario: Tiefflug
- **WHEN** die Flugkamera wieder unter 120 m sinkt
- **THEN** werden die Kacheln unter ihr wieder mit vollen Details geladen
