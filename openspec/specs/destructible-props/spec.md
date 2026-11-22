# destructible-props Specification

## Purpose
Füllt Straßen und Gärten mit kleinen Objekten (Büsche, Mülleimer, Zäune, Schilder, Laternen, Bänke), die man umfahren und zerstören kann. Die Welt räumt sich danach selbst wieder auf, ohne das Leistungsbudget des iPads zu sprengen.

## Requirements

### Requirement: Arten von Kleinobjekten
Die Welt SHALL mindestens diese zerstörbaren Kleinobjekte enthalten: Busch, Mülleimer, Zaunfeld, Verkehrsschild, Straßenlaterne, Parkbank. Ihre Positionen kommen aus den Kacheldaten.

#### Scenario: Wohnstraße in der Kernstadt
- **WHEN** der Spieler eine Wohnstraße in der Kernstadt entlangläuft
- **THEN** sieht er auf 100 m Straße mindestens drei verschiedene Arten von Kleinobjekten

### Requirement: Verhalten beim Anfahren
Kleinobjekte SHALL im Ruhezustand statisch und billig sein. Wird ein Objekt von einem Fahrzeug oder der Spielfigur über einer artabhängigen Schwelle getroffen, MUST es reagieren: Mülleimer und Bänke werden zu Physikkörpern und kippen oder fliegen weg, Büsche, Zaunfelder und Schilder zerbrechen in 3–8 vorgefertigte Teile, Laternen knicken um.

#### Scenario: Mülleimer anfahren
- **WHEN** ein Auto mit 30 km/h einen Mülleimer trifft
- **THEN** fliegt der Mülleimer physikalisch weg und das Auto fährt weiter

#### Scenario: Busch durchfahren
- **WHEN** ein Fahrrad mit 20 km/h durch einen Busch fährt
- **THEN** zerfällt der Busch in Teile, und das Fahrrad wird nur leicht abgebremst

#### Scenario: Zu Fuß gegen eine Laterne laufen
- **WHEN** die Spielfigur zu Fuß gegen eine Laterne läuft
- **THEN** bleibt die Laterne stehen und hält die Figur auf

### Requirement: Trümmer räumen sich auf
Trümmerteile und umgestoßene Objekte SHALL nach 8 Sekunden Ruhe ausgeblendet und entfernt werden. Gleichzeitig existierende Trümmerteile MUST auf höchstens 60 begrenzt sein; bei Überschreitung verschwinden zuerst die ältesten.

#### Scenario: Viele Trümmer auf einmal
- **WHEN** der Spieler in kurzer Zeit 20 Büsche zerstört
- **THEN** existieren nie mehr als 60 Trümmerteile gleichzeitig

### Requirement: Wiederaufbau
Ein zerstörtes Kleinobjekt SHALL wieder an seiner ursprünglichen Stelle stehen, sobald seine Kachel neu geladen wird oder die Stelle mindestens 60 Sekunden außer Sicht war.

#### Scenario: Zurückkehren
- **WHEN** der Spieler einen Zaun zerstört, die Kachel verlässt, sie entladen wird und er zurückkehrt
- **THEN** steht der Zaun wieder unversehrt da

### Requirement: Kleinobjekte stören das Streaming nicht
Kleinobjekte SHALL nur in Ring-0-Kacheln geladen werden und als Thin Instances bzw. zusammengeführte Meshes gezeichnet werden. Pro Kachel MUST ihr Beitrag zu den Draw Calls höchstens 8 betragen.

#### Scenario: Draw Calls einer dichten Kachel
- **WHEN** die Kachel am Blumenplatz mit allen Kleinobjekten geladen ist
- **THEN** zeigt die Leistungsanzeige durch die Kleinobjekte höchstens 8 zusätzliche Draw Calls für diese Kachel

### Requirement: Physik-Budget
Gleichzeitig aktive dynamische Physikkörper (Fahrzeuge mit voller Physik, umgestoßene Objekte, Trümmer, abgefallene Fahrzeugteile) SHALL auf höchstens 80 begrenzt sein. Bei Überschreitung MUST das Spiel die ältesten ruhenden Körper einfrieren oder entfernen, statt die Bildrate einbrechen zu lassen.

#### Scenario: Chaos-Test
- **WHEN** der Spieler auf dem Blumenplatz innerhalb von 30 Sekunden möglichst viele Objekte zerstört
- **THEN** sind nie mehr als 80 dynamische Körper aktiv
- **AND** auf dem Referenzgerät bleibt die mittlere Bildrate bei mindestens 30 fps
