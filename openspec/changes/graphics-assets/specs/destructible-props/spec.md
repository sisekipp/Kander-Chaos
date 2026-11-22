# Spec Delta

## ADDED Requirements

### Requirement: Kleinobjekte im deutschen Stil
Kleinobjekte SHALL Modelle aus der Asset-Pipeline nutzen, die zu einer deutschen Kleinstadt passen: Mülleimer, Parkbank, Straßenlaterne, Verkehrsschilder in StVO-Form und -Farbe (ohne Text), Gartenzaun und Büsche in mehreren Formen. Die Trümmerteile MUST zum jeweiligen Objekt passen (Farbe und Material).

#### Scenario: Verkehrsschild
- **WHEN** der Spieler vor einem Verkehrsschild steht
- **THEN** hat es die Form und Farben eines StVO-Schildes

#### Scenario: Zerbrochener Zaun
- **WHEN** ein Gartenzaun zerbricht
- **THEN** sind die Trümmer Holzlatten in der Farbe des Zauns
