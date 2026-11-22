# world-streaming Specification

## Purpose

Baut die Spielwelt der ganzen Gemeinde Kandern zur Laufzeit aus den Kacheldaten auf, lädt und entlädt Kacheln abhängig von der Spielerposition und stellt sie im stilisierten Look mit echter Geometrie dar.

## Requirements

### Requirement: Detailstufen-Ringe um den Spieler
Die Welt SHALL Kacheln in drei Detailstufen um den Spieler herum darstellen: volle Details in der Spielerkachel und ihren direkten Nachbarn, vereinfachte Darstellung im nächsten Ring und nur Gelände mit groben Silhouetten bis zur Sichtgrenze.

#### Scenario: Wechsel der Detailstufe
- **WHEN** der Spieler eine Kachelgrenze überquert
- **THEN** werden Kacheln, die in einen näheren Ring wandern, auf die höhere Detailstufe gebracht
- **AND** Kacheln, die in einen ferneren Ring wandern, auf eine niedrigere Stufe gesetzt

### Requirement: Entladen ferner Kacheln
Kacheln außerhalb der Sichtgrenze SHALL entladen werden, sodass Speicher- und Grafikressourcen frei werden. Die Anzahl gleichzeitig geladener Kacheln MUST unabhängig von der Gesamtgröße der Welt begrenzt sein.

#### Scenario: Lange Fahrt durch die Gemeinde
- **WHEN** der Spieler von Feuerbach über die Kernstadt nach Wollbach fährt
- **THEN** bleibt die Zahl geladener Kacheln innerhalb der festgelegten Obergrenze
- **AND** der Speicherverbrauch wächst nicht dauerhaft an

### Requirement: Nachladen ohne Ruckeln
Die Erzeugung von Kachel-Geometrie SHALL außerhalb des Render-Threads stattfinden. Das Einhängen einer fertigen Kachel in die Szene MUST so aufgeteilt werden, dass kein einzelnes Bild länger als 100 ms dauert.

#### Scenario: Neue Kachel beim Fahren
- **WHEN** während schneller Bewegung eine neue Detailkachel erzeugt wird
- **THEN** sinkt die Bildrate nicht unter das Ziel aus dem Performance-Budget, abgesehen von höchstens einem Bild unter 100 ms

### Requirement: Vorausladen in Bewegungsrichtung
Die Welt SHALL Kacheln in Bewegungsrichtung des Spielers bevorzugt laden, sodass bei der Höchstgeschwindigkeit der Testbewegung (80 km/h) keine fehlende Detailkachel in der Spielerkachel sichtbar wird.

#### Scenario: Geradeausfahrt mit Höchstgeschwindigkeit
- **WHEN** sich der Spieler mit 80 km/h geradeaus über mehrere Kachelgrenzen bewegt
- **THEN** ist die Kachel, die er betritt, bereits in voller Detailstufe geladen

### Requirement: Gelände
Die Welt SHALL das Gelände aus den Höhendaten der Kacheln darstellen, mit nahtlosen Übergängen zwischen Kacheln und Detailstufen, ohne sichtbare Löcher oder Risse.

#### Scenario: Übergang zwischen Detailstufen
- **WHEN** eine Detailkachel an eine vereinfachte Kachel grenzt
- **THEN** sind an der Grenze keine Lücken im Gelände sichtbar

### Requirement: Prozedurale Gebäude
Die Welt SHALL Gebäude zur Laufzeit aus Grundriss, Höhe, Dachform und Gebäudetyp erzeugen. Dasselbe Gebäude MUST bei jedem Laden identisch aussehen (gleiche Form, Farbe und Fassade).

#### Scenario: Wiedererkennbares Gebäude
- **WHEN** der Spieler eine Kachel verlässt, sie entladen wird und er zurückkehrt
- **THEN** sehen alle Gebäude darin genau gleich aus wie vorher

#### Scenario: Dachformen
- **WHEN** ein Gebäude in den Daten als Satteldach, Walmdach oder Flachdach markiert ist
- **THEN** wird es mit der entsprechenden Dachform dargestellt

### Requirement: Stilisierte Fassaden nach Gebäudetyp
Gebäude SHALL je nach Typ unterscheidbare, stilisierte Fassaden erhalten, mindestens für Fachwerk (Altstadt), Putzhaus, Scheune/Hof, Gewerbe und öffentliche Gebäude.

#### Scenario: Altstadt und Gewerbe unterscheidbar
- **WHEN** der Spieler in der Kernstadt und anschließend in einem Gewerbegebiet steht
- **THEN** unterscheiden sich die Fassaden deutlich in Farbe und Muster

### Requirement: Straßen auf dem Gelände
Die Welt SHALL Straßen und Wege entsprechend Typ und Breite als befahrbare Flächen darstellen, die dem Gelände folgen, ohne darin zu versinken oder darüber zu schweben.

#### Scenario: Straße am Hang
- **WHEN** eine Straße einen Hang hinaufführt
- **THEN** liegt die Straßenoberfläche durchgehend auf dem Gelände

### Requirement: Vegetation und Landnutzung
Die Welt SHALL Wald, Wiesen, Äcker, Obstwiesen und Gewässer entsprechend der Landnutzungsdaten darstellen. Bäume MUST in Wäldern dicht genug stehen, dass Wald als Wald wahrgenommen wird, und in Fernsicht als Silhouette sichtbar bleiben.

#### Scenario: Waldrand
- **WHEN** der Spieler auf eine Waldfläche zuläuft
- **THEN** stehen an der Waldgrenze Bäume, und außerhalb der Waldfläche stehen keine Waldbäume

### Requirement: Kollision mit der Welt
Die Spielfigur SHALL mit Gelände und Gebäuden in der Detailstufe kollidieren. Sie MUST NOT durch Gebäude laufen oder unter das Gelände fallen, auch nicht beim Laden oder Entladen von Kacheln.

#### Scenario: Gegen eine Hauswand laufen
- **WHEN** die Spielfigur gegen eine Gebäudewand läuft
- **THEN** wird sie an der Wand aufgehalten

#### Scenario: Kachelwechsel
- **WHEN** die Spielfigur eine Kachelgrenze überquert, während die neue Kachel lädt
- **THEN** fällt sie nicht durch das Gelände

### Requirement: Spielbarer Testausschnitt
Die App SHALL einen Testmodus bieten, in dem sich eine Spielfigur per Touch-Steuerung (virtueller Joystick und Kamerawischen) durch die Welt bewegen lässt. Ein Schnellfahrmodus mit 80 km/h MUST verfügbar sein, um das Streaming zu prüfen. Startpunkt ist die Kernstadt Kandern.

#### Scenario: Start in der Kernstadt
- **WHEN** der Testmodus startet
- **THEN** steht die Spielfigur in der Kernstadt Kandern und kann sich per Touch bewegen

#### Scenario: Schnellfahrmodus
- **WHEN** der Nutzer den Schnellfahrmodus aktiviert
- **THEN** bewegt sich die Spielfigur mit 80 km/h über das Gelände
