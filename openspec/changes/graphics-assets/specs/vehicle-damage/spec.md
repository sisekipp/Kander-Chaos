# Spec Delta

## ADDED Requirements

### Requirement: Lösbare Teile in Fahrzeugmodellen
Jedes Fahrzeugmodell SHALL seine lösbaren Teile (z. B. Stoßstangen, Spiegel, Schutzbleche, Lenker) als eigene, gekennzeichnete Teile enthalten, damit die Schadensstufen mit allen Modellen funktionieren. Modelle ohne mindestens zwei lösbare Teile MUST von der Asset-Pipeline abgelehnt werden.

#### Scenario: Neues Automodell
- **WHEN** ein neues Automodell ohne gekennzeichnete lösbare Teile aufgenommen wird
- **THEN** meldet die Asset-Pipeline einen Fehler
