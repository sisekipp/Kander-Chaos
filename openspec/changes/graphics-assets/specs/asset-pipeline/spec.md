# Spec Delta

## Purpose

Regelt, woher die 3D-Modelle des Spiels stammen, wie sie lizenzrechtlich dokumentiert, auf den regionalen Stil geprüft, optimiert und komprimiert werden und wie sie offline und innerhalb des Größenbudgets ins Spiel kommen.

## ADDED Requirements

### Requirement: Nur frei nutzbare Modelle mit Lizenzregister
Eingebundene Fremdmodelle SHALL unter CC0 oder einer gleichwertig freien Lizenz stehen, die kommerzielle Nutzung und Veränderung erlaubt. Für jedes Modell MUST ein Eintrag im Lizenzregister existieren (Quelle/URL, Paketname, Lizenz, Abrufdatum, Änderungen). Der Build MUST fehlschlagen, wenn ein Modell keinen Eintrag hat.

#### Scenario: Modell ohne Registereintrag
- **WHEN** ein neues Modell ohne Eintrag im Lizenzregister in den Asset-Ordner gelegt wird
- **THEN** bricht der Build mit einer Meldung ab, welches Modell fehlt

### Requirement: Regional passender Stil
Fahrzeug- und Gegenstandsmodelle SHALL zu einer deutschen bzw. europäischen Kleinstadt passen. US-typische Fahrzeuge (Pickups, Schulbusse, US-Polizei- und Taxifahrzeuge) und echte Markenlogos oder -schriftzüge MUST NOT vorkommen. Verkehrsschilder MUST die Formen und Farben der StVO-Schilder haben.

#### Scenario: Prüfliste
- **WHEN** ein Fahrzeug- oder Gegenstandsmodell aufgenommen wird
- **THEN** ist im Lizenzregister vermerkt, dass es die Stilprüfung (europäisch, ohne Logos) bestanden hat

### Requirement: Optimierung und Komprimierung
Alle Modelle SHALL im Build optimiert werden: doppelte Daten zusammengefasst, Geometrie quantisiert, meshopt-komprimiert. Texturen MUST höchstens 512×512 Pixel groß sein, nach Möglichkeit eine gemeinsame Farbpaletten-Textur. Die Modelle zusammen MUST im Build höchstens 15 MB belegen.

#### Scenario: Größenprüfung
- **WHEN** der Build die Modelle optimiert hat
- **THEN** meldet er die Gesamtgröße und schlägt fehl, wenn 15 MB überschritten werden

### Requirement: Offline-Laden ohne CDN
Decoder für komprimierte Modelle SHALL mit dem Spiel ausgeliefert und lokal geladen werden. Beim Laden von Modellen MUST keine Anfrage an fremde Hosts entstehen.

#### Scenario: Modelle offline
- **WHEN** das Spiel offline startet und Fahrzeuge, Figur und Gegenstände lädt
- **THEN** werden alle Modelle angezeigt, ohne dass eine Anfrage an fremde Hosts gestellt wird

### Requirement: Einheitliche Spielpalette
Modelle SHALL beim Import in die Farbpalette des Spiels umgefärbt werden können (Lack-, Kleidungs- und Materialfarben als austauschbare Farbzonen), damit Fremdmodelle einheitlich aussehen.

#### Scenario: Gleiches Automodell, andere Farben
- **WHEN** zwei geparkte Autos dasselbe Modell nutzen
- **THEN** können sie unterschiedliche Lackfarben aus der Spielpalette haben

### Requirement: Figuren-Baukasten für NPCs
Die Pipeline SHALL mindestens 8 unterscheidbare Figuren (Erwachsene und Kinder, verschiedene Kleidung) mit einem gemeinsamen Satz an Animationen (stehen, gehen, rennen, umfallen, aufstehen, winken) bereitstellen. Für viele gleichzeitige Figuren MUST eine gebackene Vertex-Animation (Animationstextur) erzeugt werden.

#### Scenario: Acht Figuren nebeneinander
- **WHEN** im Testmodus alle NPC-Figuren nebeneinander angezeigt werden
- **THEN** sind 8 unterschiedliche Figuren zu sehen, die mit gebackener Animation gehen
