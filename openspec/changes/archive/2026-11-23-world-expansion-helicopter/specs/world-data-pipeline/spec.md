# Spec Delta

## MODIFIED Requirements

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

### Requirement: Gelände aus echten Höhendaten
Die Pipeline SHALL für jede Kachel ein Höhenraster mit einer Auflösung von höchstens 2 m für die Detailstufe erzeugen und zusätzlich gröbere Detailstufen für die Fernsicht. Quellen MUST das DGM des LGL BW (Deutschland), swissALTI3D von swisstopo (Schweiz) und RGE ALTI des IGN (Frankreich) sein, umgerechnet in dasselbe Koordinatensystem. An den Landesgrenzen MUST das Gelände ohne Stufe ineinander übergehen.

#### Scenario: Höhengenauigkeit
- **WHEN** die Geländehöhe an einem bekannten Punkt (z. B. Blumenplatz Kandern, Marktplatz Basel) abgefragt wird
- **THEN** weicht sie um höchstens 2 m vom Wert der jeweiligen Quelle ab

#### Scenario: Grenze ohne Stufe
- **WHEN** das Gelände an der deutsch-schweizerischen Grenze in Weil am Rhein abgefragt wird
- **THEN** springt die Höhe zwischen benachbarten Rasterpunkten um höchstens 1 m

### Requirement: Kompaktes Ausgabeformat
Die Kacheldaten der Kernregion (ohne geteilte Assets wie Texturen und Modelle) SHALL komprimiert höchstens 120 MB groß sein. Die Kacheldaten aller Nachladeregionen zusammen SHALL höchstens 800 MB groß sein, und kein einzelnes Regionspaket MUST größer als 25 MB sein.

#### Scenario: Größenprüfung
- **WHEN** die Pipeline fertig ist
- **THEN** gibt sie die Größen von Kern- und Nachladeregionen getrennt aus und schlägt fehl, wenn eine Grenze überschritten wird

### Requirement: Größenbudget mit Kleinobjekten
Auch mit Kleinobjekten und Parkpositionen SHALL das Größenbudget der Kacheldaten der Kernregion von 120 MB eingehalten werden. In Nachladeregionen MUST die Dichte der Kleinobjekte so begrenzt werden, dass das Budget der Nachladeregionen eingehalten wird.

#### Scenario: Budget nach Erweiterung
- **WHEN** die Pipeline mit Kleinobjekten fertig ist
- **THEN** meldet `check` für die Kernregion höchstens 120 MB und für die Nachladeregionen höchstens 800 MB

## ADDED Requirements

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
