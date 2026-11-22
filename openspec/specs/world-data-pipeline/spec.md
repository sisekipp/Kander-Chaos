# world-data-pipeline Specification

## Purpose

Wandelt echte Geodaten (OpenStreetMap und das Geländemodell des LGL Baden-Württemberg) reproduzierbar in kompakte Kachel-Dateien um, aus denen das Spiel die Welt der Gemeinde Kandern aufbaut.

## Requirements

### Requirement: Abdeckung der ganzen Gemeinde
Die Pipeline SHALL Kacheln für das gesamte Gemeindegebiet Kandern einschließlich aller Ortsteile erzeugen, zuzüglich eines Randstreifens von mindestens 500 m. Grundlage ist die Gemeindegrenze aus OSM.

#### Scenario: Ortsteile enthalten
- **WHEN** die Pipeline vollständig durchläuft
- **THEN** existieren Kacheln mit Gebäuden für die Kernstadt und für Wollbach, Holzen, Riedlingen, Tannenkirch, Sitzenkirch und Feuerbach

#### Scenario: Gebiet außerhalb
- **WHEN** eine Kachel vollständig außerhalb von Gemeinde und Randstreifen liegt
- **THEN** wird für sie keine Detail-Kachel erzeugt

### Requirement: Einheitliches Kachelraster
Die Pipeline SHALL die Welt in ein festes quadratisches Raster mit einer konfigurierbaren Kantenlänge (Standard 250 m) in einem metrischen, lokalen Koordinatensystem aufteilen. Benachbarte Kacheln MUST nahtlos aneinander passen.

#### Scenario: Nahtlose Geländekanten
- **WHEN** zwei benachbarte Kacheln geladen sind
- **THEN** stimmen die Geländehöhen an der gemeinsamen Kante überein

### Requirement: Gelände aus echten Höhendaten
Die Pipeline SHALL für jede Kachel ein Höhenraster aus dem DGM des LGL BW mit einer Auflösung von höchstens 2 m für die Detailstufe erzeugen und zusätzlich gröbere Detailstufen für die Fernsicht.

#### Scenario: Höhengenauigkeit
- **WHEN** die Geländehöhe an einem bekannten Punkt (z. B. Blumenplatz Kandern) abgefragt wird
- **THEN** weicht sie um höchstens 2 m vom DGM-Wert ab

### Requirement: Gebäude als Grundriss-Daten
Die Pipeline SHALL Gebäude als Grundriss mit Höhe bzw. Stockwerkszahl, Dachform und Gebäudetyp ausgeben, nicht als fertige 3D-Modelle. Fehlende Angaben MUST nach festen, dokumentierten Regeln ergänzt werden.

#### Scenario: Fehlende Stockwerksangabe
- **WHEN** ein OSM-Gebäude keine Höhen- oder Stockwerksangabe hat
- **THEN** erhält es einen Standardwert, der vom Gebäudetyp und von der Grundfläche abhängt
- **AND** derselbe Eingabestand ergibt immer denselben Wert

#### Scenario: Gebäude über Kachelgrenze
- **WHEN** ein Gebäude-Grundriss zwei Kacheln schneidet
- **THEN** wird es genau einer Kachel zugeordnet und erscheint im Spiel genau einmal

### Requirement: Straßen als Netz
Die Pipeline SHALL Straßen und Wege als zusammenhängendes Netz mit Straßentyp, Breite und Verbindungspunkten ausgeben. Das Netz MUST über Kachelgrenzen hinweg verbunden bleiben, damit spätere Fahrzeug- und Verkehrssysteme darauf aufbauen können.

#### Scenario: Durchgehende Straße
- **WHEN** man dem Straßennetz von der Kernstadt nach Tannenkirch folgt
- **THEN** existiert eine zusammenhängende Verbindung ohne Lücken an Kachelgrenzen

### Requirement: Landnutzung und Gewässer
Die Pipeline SHALL Flächen für Wald (Laub, Nadel, Misch), Wiese, Acker, Obstwiese, Weinberg, Siedlungsfläche und Gewässer (z. B. die Kander) je Kachel ausgeben.

#### Scenario: Wald vorhanden
- **WHEN** eine Kachel laut OSM Waldfläche enthält
- **THEN** enthalten die Kacheldaten diese Fläche mit Waldtyp

### Requirement: Reproduzierbarkeit und Versionierung
Die Pipeline SHALL aus denselben Eingabedaten und derselben Konfiguration bytegleiche Ausgaben erzeugen. Jeder Ausgabesatz MUST eine Versionskennung und das Datum der Quelldaten enthalten.

#### Scenario: Wiederholter Lauf
- **WHEN** die Pipeline zweimal mit identischen Eingaben läuft
- **THEN** sind alle erzeugten Kachel-Dateien identisch

### Requirement: Kompaktes Ausgabeformat
Die Kacheldaten der ganzen Gemeinde (ohne geteilte Assets wie Texturen und Modelle) SHALL komprimiert höchstens 120 MB groß sein.

#### Scenario: Größenprüfung
- **WHEN** die Pipeline fertig ist
- **THEN** gibt sie die Gesamtgröße aus und schlägt fehl, wenn 120 MB überschritten werden

### Requirement: Quellen- und Lizenznachweis
Die Pipeline SHALL eine maschinenlesbare Datei mit allen verwendeten Datenquellen, Lizenzen, Abrufdaten und Pflicht-Namensnennungen erzeugen, die das Spiel für seine Quellenseite verwendet.

#### Scenario: Nachweisdatei
- **WHEN** die Pipeline fertig ist
- **THEN** existiert eine Nachweisdatei mit Einträgen für OSM (ODbL) und LGL BW (Datenlizenz Deutschland)
