# world-data-pipeline Specification

## Purpose

Wandelt echte Geodaten (OpenStreetMap und das Geländemodell des LGL Baden-Württemberg) reproduzierbar in kompakte Kachel-Dateien um, aus denen das Spiel die Welt der Gemeinde Kandern aufbaut.

## Requirements

### Requirement: Abdeckung der ganzen Gemeinde
Die Pipeline SHALL Kacheln für das regionale Spielgebiet erzeugen: das Gebiet zwischen Müllheim im Norden, Lörrach im Osten, Basel im Süden und dem Rhein bzw. dem EuroAirport im Westen (mindestens Müllheim, Kandern mit allen Ortsteilen, Lörrach, Weil am Rhein, Basel und den Flughafen). Die Gemeinde Kandern mit einem Randstreifen von mindestens 500 m bildet die Kernregion. Grundlage sind die Gemeindegrenze aus OSM und ein festes Rechteck für das Spielgebiet.

#### Scenario: Ortsteile enthalten
- **WHEN** die Pipeline vollständig durchläuft
- **THEN** existieren Kacheln mit Gebäuden für die Kernstadt und für Wollbach, Holzen, Riedlingen, Tannenkirch, Sitzenkirch und Feuerbach

#### Scenario: Städte der Region enthalten
- **WHEN** die Pipeline vollständig durchläuft
- **THEN** existieren Kacheln mit Gebäuden für Müllheim, Lörrach, Weil am Rhein und die Basler Innenstadt sowie Kacheln mit den Pisten des EuroAirport

#### Scenario: Gebiet außerhalb
- **WHEN** eine Kachel vollständig außerhalb des Spielgebiets liegt
- **THEN** wird für sie keine Detail-Kachel erzeugt

### Requirement: Einheitliches Kachelraster
Die Pipeline SHALL die Welt in ein festes quadratisches Raster mit einer konfigurierbaren Kantenlänge (Standard 250 m) in einem metrischen, lokalen Koordinatensystem aufteilen. Benachbarte Kacheln MUST nahtlos aneinander passen.

#### Scenario: Nahtlose Geländekanten
- **WHEN** zwei benachbarte Kacheln geladen sind
- **THEN** stimmen die Geländehöhen an der gemeinsamen Kante überein

### Requirement: Gelände aus echten Höhendaten
Die Pipeline SHALL für jede Kachel ein Höhenraster mit einer Auflösung von höchstens 2 m für die Detailstufe erzeugen und zusätzlich gröbere Detailstufen für die Fernsicht. Quellen MUST das DGM des LGL BW (Deutschland), swissALTI3D von swisstopo (Schweiz) und RGE ALTI des IGN (Frankreich) sein, umgerechnet in dasselbe Koordinatensystem. An den Landesgrenzen MUST das Gelände ohne Stufe ineinander übergehen.

#### Scenario: Höhengenauigkeit
- **WHEN** die Geländehöhe an einem bekannten Punkt (z. B. Blumenplatz Kandern, Marktplatz Basel) abgefragt wird
- **THEN** weicht sie um höchstens 2 m vom Wert der jeweiligen Quelle ab

#### Scenario: Grenze ohne Stufe
- **WHEN** das Gelände an der deutsch-schweizerischen Grenze in Weil am Rhein abgefragt wird
- **THEN** springt die Höhe zwischen benachbarten Rasterpunkten um höchstens 1 m

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
Die Kacheldaten der Kernregion (ohne geteilte Assets wie Texturen und Modelle) SHALL komprimiert höchstens 120 MB groß sein. Die Kacheldaten aller Nachladeregionen zusammen SHALL höchstens 800 MB groß sein, und kein einzelnes Regionspaket MUST größer als 25 MB sein.

#### Scenario: Größenprüfung
- **WHEN** die Pipeline fertig ist
- **THEN** gibt sie die Größen von Kern- und Nachladeregionen getrennt aus und schlägt fehl, wenn eine Grenze überschritten wird

### Requirement: Quellen- und Lizenznachweis
Die Pipeline SHALL eine maschinenlesbare Datei mit allen verwendeten Datenquellen, Lizenzen, Abrufdaten und Pflicht-Namensnennungen erzeugen, die das Spiel für seine Quellenseite verwendet.

#### Scenario: Nachweisdatei
- **WHEN** die Pipeline fertig ist
- **THEN** existiert eine Nachweisdatei mit Einträgen für OSM (ODbL) und LGL BW (Datenlizenz Deutschland)

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
Auch mit Kleinobjekten und Parkpositionen SHALL das Größenbudget der Kacheldaten der Kernregion von 120 MB eingehalten werden. In Nachladeregionen MUST die Dichte der Kleinobjekte so begrenzt werden, dass das Budget der Nachladeregionen eingehalten wird.

#### Scenario: Budget nach Erweiterung
- **WHEN** die Pipeline mit Kleinobjekten fertig ist
- **THEN** meldet `check` für die Kernregion höchstens 120 MB und für die Nachladeregionen höchstens 800 MB

### Requirement: Autobahnen, Bahnstrecken und Flughafen
Die Pipeline SHALL Autobahnen (mit Fahrtrichtungen, Brücken und Anschlussstellen), Bahnstrecken (Gleise, Brücken, Tunnelportale), Bahnhöfe mit Bahnsteigen sowie die Flughafenflächen (Pisten, Rollwege, Vorfeld, Hubschrauberlandeplätze) als eigene Arten ausgeben, damit das Spiel sie darstellen und spätere Züge und Flugzeuge sie nutzen können.

#### Scenario: Autobahn A5
- **WHEN** die Kacheln bei Weil am Rhein gelesen werden
- **THEN** enthalten sie die A5 als Autobahn mit zwei Richtungsfahrbahnen

#### Scenario: Pisten des EuroAirport
- **WHEN** die Kacheln am Flughafen gelesen werden
- **THEN** enthalten sie die Pisten als eigene Flächenart

### Requirement: Echte Gebäudehöhen für Hochhäuser
Die Pipeline SHALL für Gebäude mit Höhenangabe (`height`, `building:levels`) diese Werte übernehmen, auch über 100 m. Hochhäuser (ab 40 m) MUST zusätzlich in einer Fernsicht-Liste je Region stehen, damit sie aus großer Entfernung als Silhouette sichtbar sind.

#### Scenario: Roche-Turm
- **WHEN** das höchste Gebäude der Basler Innenstadt gelesen wird
- **THEN** hat es eine Höhe von über 150 m
- **AND** steht in der Fernsicht-Liste seiner Region

### Requirement: Mehrere Quellen im Lizenznachweis
Die Quellenangaben SHALL alle verwendeten Höhenquellen mit ihrer Lizenz und Namensnennung enthalten (LGL BW, swisstopo, IGN) zusätzlich zu OpenStreetMap.

#### Scenario: Seite „Über das Spiel“
- **WHEN** der Spieler die Seite „Über das Spiel“ öffnet
- **THEN** sind OSM, LGL, swisstopo und IGN mit Lizenz genannt
