# Spec Delta

## ADDED Requirements

### Requirement: Straßenattribute für die Darstellung
Die Pipeline SHALL je Straße zusätzlich ausgeben: Anzahl Fahrstreifen, Einbahn, Gehweg (keiner/links/rechts/beidseitig), Belag (Asphalt, Pflaster, Schotter, Erde) und Ebene (`layer`). Fehlende Angaben MUST nach dokumentierten Regeln ergänzt werden (z. B. Gehwege an Wohn- und Hauptstraßen im bebauten Umfeld).

#### Scenario: Fehlende Gehwegangabe
- **WHEN** eine Wohnstraße im Ortskern keine `sidewalk`-Angabe hat
- **THEN** erhält sie nach Regel beidseitig einen Gehweg

### Requirement: Kreuzungsflächen
Die Pipeline SHALL für jede Kreuzung bzw. Einmündung mit mindestens drei Straßenarmen eine Kreuzungsfläche (Polygon) und die Kürzung der angrenzenden Straßen auf deren Rand berechnen und je Kachel ausgeben.

#### Scenario: T-Kreuzung
- **WHEN** drei Straßen an einem Knoten zusammentreffen
- **THEN** enthalten die Kacheldaten ein Kreuzungspolygon, und die drei Straßen enden an dessen Rand

### Requirement: Brücken- und Tunnelhöhen
Die Pipeline SHALL für Brücken die Fahrbahnhöhe an beiden Enden aus dem Gelände bestimmen und für die Brücke einen gleichmäßigen Höhenverlauf ausgeben. Brücken, die über Kachelgrenzen laufen, MUST in allen Kacheln denselben Verlauf haben.

#### Scenario: Brücke über zwei Kacheln
- **WHEN** eine Brücke eine Kachelgrenze überquert
- **THEN** stimmt die Fahrbahnhöhe beider Teile an der Grenze überein

### Requirement: Zebrastreifen und Kirchtürme
Die Pipeline SHALL Fußgängerüberwege (`highway=crossing` mit Zebrastreifen-Markierung) als Position mit Querrichtung je Kachel ausgeben sowie für Kirchen die Lage des Turms (aus Gebäudeteilen `building:part=tower`/`man_made=tower` oder nach Regel an einer Schmalseite).

#### Scenario: Kirche ohne Turm-Teil in den Daten
- **WHEN** eine Kirche in OSM keinen eigenen Turm-Teil hat
- **THEN** erhält sie einen Turm an der westlichen Schmalseite des Kirchenschiffs

### Requirement: Rückwärtskompatibilität des Darstellungsabschnitts
Die neuen Angaben SHALL in einem weiteren optionalen Abschnitt des Kachelblocks stehen, ohne `FORMAT_VERSION` zu erhöhen. Ältere Versionen der App MUST die Kacheln weiterhin lesen können.

#### Scenario: Alter Leser
- **WHEN** eine Kachel mit dem neuen Abschnitt von einem Leser ohne dessen Kenntnis gelesen wird
- **THEN** werden alle übrigen Abschnitte korrekt gelesen
