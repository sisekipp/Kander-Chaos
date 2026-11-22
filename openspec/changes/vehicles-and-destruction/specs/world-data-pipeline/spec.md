# Spec Delta

## ADDED Requirements

### Requirement: Straßenmöbel und Grenzlinien
Die Pipeline SHALL je Kachel Kleinobjekte (Busch, Mülleimer, Zaunfeld, Verkehrsschild, Straßenlaterne, Parkbank) mit Position, Ausrichtung und Art ausgeben. Quellen sind OSM-Objekte (z. B. `highway=street_lamp`, `amenity=waste_basket`, `amenity=bench`, `barrier=fence`, `barrier=hedge`) sowie eine deterministische Ergänzung nach dokumentierten Regeln (z. B. Laternen entlang von Wohnstraßen, Büsche und Zäune an Grundstücksrändern). Objekte MUST NOT auf Fahrbahnen oder in Gebäuden liegen.

#### Scenario: Ergänzung ist deterministisch
- **WHEN** die Pipeline zweimal mit identischen Eingaben läuft
- **THEN** sind Anzahl, Art und Position aller Kleinobjekte identisch

#### Scenario: Keine Objekte auf der Fahrbahn
- **WHEN** die Pipeline Kleinobjekte für eine Kachel erzeugt
- **THEN** liegt keines innerhalb der Fahrbahnbreite einer Straße für Kraftfahrzeuge oder innerhalb eines Gebäudegrundrisses

### Requirement: Parkpositionen
Die Pipeline SHALL je Kachel Parkpositionen mit Position, Fahrtrichtung und bevorzugter Fahrzeugart ausgeben, abgeleitet aus OSM-Parkplätzen (`amenity=parking`) und deterministisch am Rand von Wohn- und Nebenstraßen. Parkpositionen MUST mindestens 6 m voneinander entfernt sein und dürfen keine Kreuzungen, Gebäude oder Fahrbahnen anderer Straßen überdecken.

#### Scenario: Parkpositionen in der Kernstadt
- **WHEN** die Pipeline die Kacheln rund um den Blumenplatz erzeugt
- **THEN** enthalten sie zusammen mindestens 10 Parkpositionen

### Requirement: Abwärtskompatible Erweiterung des Formats
Kleinobjekte und Parkpositionen SHALL in einem neuen, optionalen Abschnitt des Kachelblocks gespeichert werden, ohne `FORMAT_VERSION` zu erhöhen. Spiele ohne Unterstützung für den Abschnitt MUST die Kachel weiterhin fehlerfrei lesen.

#### Scenario: Alter Leser, neue Kachel
- **WHEN** eine Kachel mit Props-Abschnitt von einem Leser ohne Kenntnis dieses Abschnitts dekodiert wird
- **THEN** werden Gelände, Gebäude, Straßen, Landnutzung und Gewässer korrekt gelesen und der neue Abschnitt übersprungen

### Requirement: Größenbudget mit Kleinobjekten
Auch mit Kleinobjekten und Parkpositionen SHALL das Größenbudget der Kacheldaten von 120 MB eingehalten werden.

#### Scenario: Budget nach Erweiterung
- **WHEN** die Pipeline mit Kleinobjekten fertig ist
- **THEN** meldet `check` eine Gesamtgröße von höchstens 120 MB
