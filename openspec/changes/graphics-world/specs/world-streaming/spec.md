# Spec Delta

## MODIFIED Requirements

### Requirement: Straßen auf dem Gelände
Die Welt SHALL Straßen und Wege entsprechend Typ und Breite als befahrbare Flächen darstellen, die dem Gelände folgen, ohne darin zu versinken oder darüber zu schweben. Ausgenommen sind Brücken (eigene Fahrbahnhöhe zwischen den Brückenenden) und Tunnel (im Inneren nicht gezeichnet), siehe `road-rendering`.

#### Scenario: Straße am Hang
- **WHEN** eine Straße einen Hang hinaufführt
- **THEN** liegt die Straßenoberfläche durchgehend auf dem Gelände

#### Scenario: Brücke ist ausgenommen
- **WHEN** eine als Brücke markierte Straße über ein Tal führt
- **THEN** folgt ihre Fahrbahn nicht dem Gelände, sondern verläuft zwischen den Brückenenden
